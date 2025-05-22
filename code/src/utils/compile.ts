import Mustache from "mustache";

export const compile = (prompt: string, data: any) => {
	return Mustache.render(prompt, data);
};
