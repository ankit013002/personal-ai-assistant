export function guardAssistantPersona(answer: string): string {
  const userRoleplayPatterns = [
    /\bI(?:'m| am) the user\b/i,
    /\bmy condo in Fairborn\b/i,
    /\bmy projects\b/i
  ];

  if (!userRoleplayPatterns.some((pattern) => pattern.test(answer))) {
    return answer;
  }

  return [
    "Persona correction: I am Ankit's assistant, not Ankit.",
    "",
    answer
      .replace(/\bHello!\s*/i, "")
      .replace(/\bI(?:'m| am) the user\b/gi, "You are the user")
      .replace(/\bMy primary focus is\b/gi, "Your primary focus is")
      .replace(/\bmy condo in Fairborn\b/gi, "your condo in Fairborn")
      .replace(/\bmy condo\b/gi, "your condo")
      .replace(/\bmy projects\b/gi, "your projects")
      .replace(/\bmy goal is\b/gi, "your goal is")
  ].join("\n");
}
