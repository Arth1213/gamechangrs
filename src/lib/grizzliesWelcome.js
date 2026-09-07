function getGrizzliesWelcomeName(user) {
  const fullName = user?.user_metadata?.full_name?.trim();
  const emailName = user?.email?.split("@")[0];
  return fullName || emailName || null;
}

export function grizzliesWelcomeParts(user) {
  const name = getGrizzliesWelcomeName(user);
  return name
    ? { prefix: "Welcome ", name, suffix: " to the 2026 Grizzlies Season." }
    : { prefix: "Welcome to the 2026 Grizzlies Season.", name: null, suffix: "" };
}

export function grizzliesWelcome(user) {
  const { prefix, name, suffix } = grizzliesWelcomeParts(user);
  return `${prefix}${name || ""}${suffix}`;
}
