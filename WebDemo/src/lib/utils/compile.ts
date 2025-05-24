import Mustache from 'mustache';

export const compile = (prompt: string, data: string) => {
  return Mustache.render(prompt, data);
};
