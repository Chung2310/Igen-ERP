/** Keep both offline matrices on the same live-catalog scope. */
export const functionMatrixModules = (process.env.ASSISTANT_MATRIX_MODULES ||
  'hr,quotation,student,worker,labor-partner,retail-partner,student-partner,healthcare,inventory,repair,retail,finance')
  .split(',').map(value => value.trim()).filter(Boolean);
