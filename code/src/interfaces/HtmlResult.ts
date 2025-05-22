export type NestedTextMap = string | { [key: string]: NestedTextMap };

export interface HtmlResult {
	html: string;
	textMap: NestedTextMap;
	textMapFlat: { [key: string]: string }; 
}