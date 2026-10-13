import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { MEDIA_BUCKET } from "../lib/profile";
import ScenicPhoto from "./ScenicPhoto";
export default function ProfileImage({
  path,
  kind,
  name,
}: {
  path: string | null;
  kind: "avatar" | "banner";
  name: string;
}) {
  const [image, setImage] = useState<{ path: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!path || !supabase) return;
    let active = true;
    let url: string | undefined;
    void supabase.storage
      .from(MEDIA_BUCKET)
      .download(path)
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        url = URL.createObjectURL(data);
        setImage({ path, url });
      })
      .catch(() => {
        /* Keep the accessible placeholder when the image is unavailable. */
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return image?.path === path ? (
    <img
      className={`profile-${kind}-image`}
      src={image.url}
      alt={
        kind === "avatar"
          ? `${name}'s profile picture`
          : `${name}'s cover photo`
      }
      onError={() => setImage(null)}
    />
  ) : kind === "banner" ? (
    <ScenicPhoto
      className="profile-banner-image"
      alt="Scenic forest road cover"
    />
  ) : (
    <span
      className="avatar-placeholder"
      role="img"
      aria-label="No profile picture"
    >
      <UserRound size={38} />
    </span>
  );
}
