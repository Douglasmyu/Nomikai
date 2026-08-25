CREATE TABLE "drinks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drinks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"is_alcoholic" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drinks_normalized_name_key" UNIQUE("normalized_name")
);
--> statement-breakpoint
ALTER TABLE "drinks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"drink_id" bigint,
	"custom_drink_name" text,
	"normalized_drink_name" text NOT NULL,
	"location" text,
	"photo_path" text,
	"note" text,
	"recommended" boolean,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"night_out_id" uuid,
	CONSTRAINT "entries_check" CHECK ((drink_id IS NULL) <> (custom_drink_name IS NULL)),
	CONSTRAINT "entries_note_check" CHECK (char_length(note) <= 140)
);
--> statement-breakpoint
ALTER TABLE "entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "friendships_check" CHECK (requester_id <> addressee_id),
	CONSTRAINT "friendships_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text]))
);
--> statement-breakpoint
ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "night_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "night_outs_id_user_id_key" UNIQUE("id","user_id"),
	CONSTRAINT "night_outs_name_check" CHECK ((char_length(name) >= 1) AND (char_length(name) <= 80))
);
--> statement-breakpoint
ALTER TABLE "night_outs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_code" text DEFAULT substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10) NOT NULL,
	"username" text NOT NULL,
	"timezone" text NOT NULL,
	"age_attested_at" timestamp with time zone NOT NULL,
	"leaderboard_opt_in" boolean DEFAULT true NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_code_key" UNIQUE("user_code"),
	CONSTRAINT "profiles_username_key" UNIQUE("username"),
	CONSTRAINT "profiles_username_check" CHECK (username ~ '^[a-z0-9_]{3,20}$'::text)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_drink_id_fkey" FOREIGN KEY ("drink_id") REFERENCES "public"."drinks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_night_out_fk" FOREIGN KEY ("night_out_id","user_id") REFERENCES "public"."night_outs"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_outs" ADD CONSTRAINT "night_outs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_user_logged_idx" ON "entries" USING btree ("user_id" timestamptz_ops,"logged_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_idx" ON "friendships" USING btree (LEAST(requester_id, addressee_id),GREATEST(requester_id, addressee_id));--> statement-breakpoint
CREATE INDEX "night_outs_user_started_idx" ON "night_outs" USING btree ("user_id" timestamptz_ops,"started_at" timestamptz_ops);--> statement-breakpoint
CREATE POLICY "authenticated read drinks" ON "drinks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "own or friends entries select" ON "entries" AS PERMISSIVE FOR SELECT TO public USING ((select auth.uid()) = user_id OR public.is_friends_with(user_id));--> statement-breakpoint
CREATE POLICY "own entries insert" ON "entries" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "own entries update" ON "entries" AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "own entries delete" ON "entries" AS PERMISSIVE FOR DELETE TO public USING ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "participants read" ON "friendships" AS PERMISSIVE FOR SELECT TO public USING ((select auth.uid()) IN (requester_id, addressee_id));--> statement-breakpoint
CREATE POLICY "requester sends" ON "friendships" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((select auth.uid()) = requester_id AND status = 'pending' AND accepted_at IS NULL);--> statement-breakpoint
CREATE POLICY "addressee accepts" ON "friendships" AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = addressee_id AND status = 'pending') WITH CHECK ((select auth.uid()) = addressee_id AND status = 'accepted');--> statement-breakpoint
CREATE POLICY "participants delete" ON "friendships" AS PERMISSIVE FOR DELETE TO public USING ((select auth.uid()) IN (requester_id, addressee_id));--> statement-breakpoint
CREATE POLICY "own or friends night outs select" ON "night_outs" AS PERMISSIVE FOR SELECT TO public USING ((select auth.uid()) = user_id OR public.is_friends_with(user_id));--> statement-breakpoint
CREATE POLICY "own night outs insert" ON "night_outs" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "own night outs update" ON "night_outs" AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "own night outs delete" ON "night_outs" AS PERMISSIVE FOR DELETE TO public USING ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "authenticated read profiles" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "insert own profile" ON "profiles" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((select auth.uid()) = id);--> statement-breakpoint
CREATE POLICY "update own profile" ON "profiles" AS PERMISSIVE FOR UPDATE TO public USING ((select auth.uid()) = id);