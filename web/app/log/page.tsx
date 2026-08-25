"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeDrinkName } from "@/lib/normalize";

type Drink = {
  id: number;
  name: string;
  normalized_name: string;
  is_alcoholic: boolean;
};

// drinkId null = free-text entry
type Selection = { drinkId: number | null; name: string };

function toLocalInput(d: Date) {
  const c = new Date(d);
  c.setMinutes(c.getMinutes() - c.getTimezoneOffset());
  return c.toISOString().slice(0, 16);
}

// Compress to JPEG targeting <500KB — not WebP: Safari/iOS can't encode it
// and silently falls back to PNG.
async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process photo"))),
      "image/jpeg",
      0.8
    )
  );
}

export default function LogPage() {
  return (
    <Suspense>
      <LogForm />
    </Suspense>
  );
}

function LogForm() {
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const [userId, setUserId] = useState<string | null>(null);

  const [drinks, setDrinks] = useState<Drink[] | null>(null);
  const drinksRequested = useRef(false);

  const [sel, setSel] = useState<Selection | null>(null);
  const [query, setQuery] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [loggedAt, setLoggedAt] = useState(() => toLocalInput(new Date()));
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [rec, setRec] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  // edit mode: path of the photo already on the entry; removePhoto marks it for deletion
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  // In-app camera (video only, no audio). Stream lives here; the effect below
  // owns stopping tracks on close/unmount.
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const camVideoRef = useRef<HTMLVideoElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    return () => camStream?.getTracks().forEach((t) => t.stop());
  }, [camStream]);

  async function openCamera() {
    setError(null);
    try {
      // Triggers the browser's standard camera permission prompt.
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setCamStream(s);
    } catch {
      setError("Camera unavailable — allow camera access or pick a file instead.");
    }
  }

  function capturePhoto() {
    const v = camVideoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    canvas.toBlob(
      (b) => {
        if (b) {
          setPhoto(new File([b], "camera.jpg", { type: "image/jpeg" }));
          setRemovePhoto(false);
          if (photoInputRef.current) photoInputRef.current.value = "";
        }
      },
      "image/jpeg",
      0.9
    );
    setCamStream(null);
  }

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      if (editId) {
        const { data, error } = await supabase
          .from("entries")
          .select("*, drinks(name)")
          .eq("id", editId)
          .single();
        if (error || !data) {
          setError("Could not load that entry.");
          return;
        }
        setSel({
          drinkId: data.drink_id,
          name: data.drink_id ? data.drinks!.name : data.custom_drink_name!,
        });
        setLoggedAt(toLocalInput(new Date(data.logged_at)));
        setLocation(data.location ?? "");
        setNote(data.note ?? "");
        setRec(data.recommended);
        setExistingPhotoPath(data.photo_path);
        setShowDetails(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function loadDrinks() {
    if (drinksRequested.current) return;
    drinksRequested.current = true;
    const { data } = await createClient()
      .from("drinks")
      .select("id, name, normalized_name, is_alcoholic")
      .order("name");
    setDrinks(data ?? []);
  }

  const normalizedQuery = normalizeDrinkName(query);
  const matches =
    normalizedQuery && drinks
      ? drinks
          .filter((d) => d.normalized_name.includes(normalizedQuery))
          .slice(0, 8)
      : [];
  const exactMatch = matches.some((d) => d.normalized_name === normalizedQuery);

  function resetForm() {
    setSel(null);
    setQuery("");
    setShowDetails(false);
    setLoggedAt(toLocalInput(new Date()));
    setLocation("");
    setNote("");
    setRec(null);
    setPhoto(null);
    setCamStream(null);
    setError(null);
    setSaved(null);
    setPending(false);
  }

  async function submit() {
    if (!sel || !userId) return;
    setError(null);

    const fields = {
      drink_id: sel.drinkId,
      custom_drink_name: sel.drinkId ? null : sel.name,
      logged_at: new Date(loggedAt).toISOString(),
      location: location.trim() || null,
      note: note.trim() || null,
      recommended: rec,
    };
    const supabase = createClient();

    if (editId) {
      setBusy(true);
      try {
        let photo_path = existingPhotoPath;
        if (photo) {
          const blob = await compressPhoto(photo);
          photo_path = existingPhotoPath ?? `${userId}/${editId}.jpg`;
          const { error } = await supabase.storage
            .from("photos")
            .upload(photo_path, blob, { contentType: "image/jpeg", upsert: true });
          if (error) throw error;
        } else if (removePhoto && existingPhotoPath) {
          const { error } = await supabase.storage
            .from("photos")
            .remove([existingPhotoPath]);
          if (error) throw error;
          photo_path = null;
        }
        const { error } = await supabase
          .from("entries")
          .update({ ...fields, photo_path })
          .eq("id", editId);
        if (error) throw error;
        setSaved({ id: editId, name: sel.name });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
      setBusy(false);
      return;
    }

    // New entry: optimistic — confirmation renders now, insert runs behind it.
    const id = crypto.randomUUID();
    const photoFile = photo;
    setSaved({ id, name: sel.name });
    setPending(true);
    try {
      let photo_path: string | null = null;
      if (photoFile) {
        const blob = await compressPhoto(photoFile);
        photo_path = `${userId}/${id}.jpg`;
        const { error } = await supabase.storage
          .from("photos")
          .upload(photo_path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("entries")
        .insert({ id, user_id: userId, ...fields, photo_path });
      if (error) throw error;
      setPending(false);
    } catch (e) {
      // restore the form with everything intact so retry is one tap
      setSaved(null);
      setPending(false);
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }

  async function deleteEntry() {
    if (!editId) return;
    setBusy(true);
    const supabase = createClient();
    if (existingPhotoPath) {
      await supabase.storage.from("photos").remove([existingPhotoPath]);
    }
    const { error } = await supabase.from("entries").delete().eq("id", editId);
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/");
    router.refresh();
  }

  if (saved) {
    return (
      <main className="flex flex-1 flex-col">
        <Header />
        <div className="px-4 py-7">
          <div className="kicker mb-2">Logged</div>
          <h2 className="text-[32px] leading-[1.05] tracking-[-0.03em]">
            {saved.name}
          </h2>
          <button className="btn btn-primary btn-block mt-6" onClick={resetForm}>
            Log another
          </button>
          {!editId && (
            <button
              className="btn btn-secondary btn-block"
              disabled={pending}
              onClick={() => {
                router.replace(`/log?id=${saved.id}`);
                setSaved(null);
              }}
            >
              Edit details
            </button>
          )}
          <Link href="/" className="btn btn-secondary btn-block">
            Done
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header />
      <form
        className="p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {sel ? (
          <div
            className="flex items-baseline gap-3 border px-3.5 py-3"
            style={{ borderColor: "var(--color-divider)" }}
          >
            <span className="mr-auto text-[20px] font-extrabold tracking-[-0.02em]">
              {sel.name}
            </span>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() => {
                setSel(null);
                setQuery("");
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="drink">What are you drinking?</label>
            <input
              id="drink"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={loadDrinks}
              placeholder="Start typing…"
              autoComplete="off"
              autoFocus
            />
            {normalizedQuery && (
              <div
                className="border border-t-0"
                style={{ borderColor: "var(--color-divider)" }}
              >
                {matches.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="block w-full cursor-pointer px-3.5 py-2.5 text-left text-[15px] hover:bg-[var(--color-surface)]"
                    onClick={() => setSel({ drinkId: d.id, name: d.name })}
                  >
                    {d.name}
                    {!d.is_alcoholic && (
                      <span className="kicker ml-2">zero proof</span>
                    )}
                  </button>
                ))}
                {!exactMatch && (
                  <button
                    type="button"
                    className="block w-full cursor-pointer px-3.5 py-2.5 text-left text-[15px] hover:bg-[var(--color-surface)]"
                    onClick={() => setSel({ drinkId: null, name: query.trim() })}
                  >
                    Log “{query.trim()}” as written
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {showDetails ? (
          <>
            <div className="field mt-4">
              <label htmlFor="loggedAt">When</label>
              <input
                id="loggedAt"
                className="input"
                type="datetime-local"
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                required
              />
            </div>
            <div className="field mt-3">
              <label htmlFor="location">Where · optional</label>
              <input
                id="location"
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="field mt-3">
              <label htmlFor="note">
                Note · optional · {note.length}/140
              </label>
              <input
                id="note"
                className="input"
                maxLength={140}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="field mt-3">
              <label>Recommend it?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn !mt-0 flex-1 !min-h-[42px] ${rec === true ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setRec(rec === true ? null : true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`btn !mt-0 flex-1 !min-h-[42px] ${rec === false ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setRec(rec === false ? null : false)}
                >
                  No
                </button>
              </div>
            </div>
            <div className="field mt-3">
              <label htmlFor="photo">
                Photo · optional
                {existingPhotoPath && !removePhoto && !photo && " · attached"}
              </label>
              <input
                id="photo"
                ref={photoInputRef}
                className="input !py-2"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  setPhoto(e.target.files?.[0] ?? null);
                  setRemovePhoto(false);
                }}
              />
              {camStream ? (
                <>
                  <video
                    className="mt-2 w-full"
                    ref={(el) => {
                      camVideoRef.current = el;
                      if (el && el.srcObject !== camStream)
                        el.srcObject = camStream;
                    }}
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-primary !mt-2 flex-1 !min-h-[42px]"
                      onClick={capturePhoto}
                    >
                      Capture
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary !mt-2 flex-1 !min-h-[42px]"
                      onClick={() => setCamStream(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary !mt-2 btn-block !min-h-[42px]"
                  onClick={openCamera}
                >
                  Take photo
                </button>
              )}
              {photo?.name === "camera.jpg" && (
                <span className="kicker mt-1 block">Camera photo attached</span>
              )}
              {existingPhotoPath && !removePhoto && !photo && (
                <button
                  type="button"
                  className="btn btn-ghost mt-1 text-sm"
                  onClick={() => setRemovePhoto(true)}
                >
                  Remove current photo
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-ghost mt-4 text-sm"
            onClick={() => setShowDetails(true)}
          >
            + Add details — time, place, note, photo
          </button>
        )}

        <button
          className="btn btn-primary btn-block mt-6"
          disabled={!sel || busy || !userId}
        >
          {editId ? "Save changes" : "Log it"}
        </button>
        {editId && (
          <button
            type="button"
            className="btn btn-block !min-h-[42px]"
            style={{
              borderColor: "var(--color-accent)",
              color: "var(--color-accent)",
              borderWidth: 1,
            }}
            disabled={busy}
            onClick={deleteEntry}
          >
            Delete entry
          </button>
        )}
        {error && (
          <p
            className="mt-4 text-sm font-semibold"
            style={{ color: "var(--color-accent)" }}
          >
            {error}
          </p>
        )}
      </form>
    </main>
  );
}

function Header() {
  return (
    <div
      className="flex items-baseline gap-2.5 border-b-2 px-4 pt-3.5 pb-3"
      style={{ borderColor: "var(--color-divider)" }}
    >
      <h1 className="mr-auto text-[20px] tracking-[-0.02em]">
        <Link href="/" className="!text-[inherit] no-underline">
          NOMIKAI
        </Link>
      </h1>
      <span className="kicker">Log a drink</span>
    </div>
  );
}
