import { type Prompt, allPrompts } from "content-collections";
import { z } from "zod";

export const getPrompt = (name: string) => {
  const prompt = allPrompts.find(
    (p: Prompt) => p._meta.fileName === `${name}.md`,
  );
  const content = prompt?.content;
  return z.string().parse(content);
};
