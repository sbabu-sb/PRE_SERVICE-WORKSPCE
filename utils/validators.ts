
export const isValidNpiLuhn = (npi: string): boolean => {
  if (!/^\d{10}$/.test(npi)) return false;
  let sum = 24; // Constant prefix for NPI (80840)
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(npi[i], 10);
    if ((i % 2) === 0) { // Double every second digit from the right
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  const checkDigit = parseInt(npi[9], 10);
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheckDigit;
};
