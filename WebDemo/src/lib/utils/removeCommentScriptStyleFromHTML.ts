export function removeCommentScriptStyleFromHTML(rawHtml: string): string {
  // Remove comments
  const noComments = rawHtml.replace(/<!--[\s\S]*?-->/g, '');

  // Remove script and style tags with content
  const noScripts = noComments.replace(/<script[\s\S]*?<\/script>/gi, '');
  const noStyles = noScripts.replace(/<style[\s\S]*?<\/style>/gi, '');

  return noStyles;
}
