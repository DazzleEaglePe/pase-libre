/** «1 producto», «3 productos»: la cantidad con la palabra en singular o en plural. */
export const conPlural = (n: number, uno: string, varios: string): string =>
  `${n} ${n === 1 ? uno : varios}`;

/** Solo la palabra, para cuando la cantidad va aparte (en negrita, por ejemplo). */
export const enPlural = (n: number, uno: string, varios: string): string =>
  n === 1 ? uno : varios;
