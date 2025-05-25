export const mapResponseToFullXPath = (
  textMapFlatJson: Record<string, string>,
  response: string[][],
): string[][] => {
  const processedRecords: string[][] = response.map((dataRecord: string[]) => {
    const dataRecordFull: string[] = [];
    for (const xpath of dataRecord) {
      let tempPath = xpath;
      if (tempPath.startsWith('/html[1]')) {
        tempPath = tempPath.substring('/html[1]'.length);
      } else if (tempPath.startsWith('/html')) {
        // This covers "/html" and "/html/..."
        tempPath = tempPath.substring('/html'.length);
      }

      if (tempPath !== '') {
        const segments = tempPath.split('/');
        const newSegments = segments.map((segment) => {
          if (segment === '') {
            // Preserve empty segments
            return '';
          }
          if (!/\[\d+\]$/.test(segment)) {
            return `${segment}[1]`;
          }
          return segment;
        });
        tempPath = newSegments.join('/');
      }
      for (const key in textMapFlatJson) {
        if (key.startsWith(tempPath)) {
          dataRecordFull.push(key);
        }
      }
    }
    return dataRecordFull;
  });
  return processedRecords;
};
