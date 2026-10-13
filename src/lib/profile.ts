export const INTERESTS = [
  "New Driver",
  "Learning Driver",
  "Experienced Driver",
  "Scenic Explorer",
  "Driving Enthusiast",
  "Weekend Cruiser",
  "City Explorer",
  "Road Tripper",
  "Relaxing Drives",
  "Night Drives",
];
export const DRIVE_STYLES = [
  "Scenic",
  "Relaxing",
  "Peaceful",
  "Slow cruise",
  "City exploration",
  "Exciting",
];
export interface ProfileRecord {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string;
  tags: string[];
  avatar_path: string | null;
  banner_path: string | null;
  visibility: "private" | "public";
}
export interface DrivePreferences {
  preferred_style: string;
  avoid_highways: boolean;
  avoid_traffic: boolean;
  avoid_complex_intersections: boolean;
}
export const DEFAULT_PREFERENCES: DrivePreferences = {
  preferred_style: "Scenic",
  avoid_highways: true,
  avoid_traffic: true,
  avoid_complex_intersections: false,
};
export const PROFILE_FIELDS =
  "id,username,display_name,bio,tags,avatar_path,banner_path,visibility";
export const MEDIA_BUCKET = "profile-media";
export function validateProfile(
  profile: Pick<ProfileRecord, "username" | "display_name" | "bio" | "tags">,
) {
  if (profile.username && !/^[a-zA-Z0-9_]{3,24}$/.test(profile.username))
    return "Use 3–24 letters, numbers or underscores for your username.";
  if ((profile.display_name?.length ?? 0) > 60)
    return "Display names can be up to 60 characters.";
  if (profile.bio.length > 280) return "Keep your bio to 280 characters.";
  if (
    profile.tags.length > 5 ||
    new Set(profile.tags).size !== profile.tags.length
  )
    return "Choose up to five different interests.";
  return null;
}
export function friendlyError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  )
    return "That username is already taken. Try another one.";
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return "Something went wrong. Check your connection and try again.";
}
