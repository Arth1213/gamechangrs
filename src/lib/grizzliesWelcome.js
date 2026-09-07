export function grizzliesWelcome(user) {
  const fullName = user?.user_metadata?.full_name?.trim();
  const emailName = user?.email?.split("@")[0];
  const displayName = fullName || emailName;
  return displayName
    ? `Welcome ${displayName} to the 2026 Grizzlies Season.`
    : "Welcome to the 2026 Grizzlies Season.";
}
