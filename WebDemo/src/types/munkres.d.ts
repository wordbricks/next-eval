declare module 'munkres-js' {
  function munkres(costMatrix: number[][]): [number, number][];
  export = munkres;
}