import slugify from "slugify";

export function slugifyUrl(url: string): string {
  const slugName = slugify(url, {
    lower: true,
    strict: true,
    trim: true,
    remove: /[*+~.()'"!:@]/g,
  });
  return slugName;
}
