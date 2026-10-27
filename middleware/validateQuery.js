// Middleware générique pour valider req.query (Zod).
// Le middleware `validate` (body) écrase req.body ; celui-ci ne touche que req.query
// et stocke le résultat dans req.query validé.
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  // On garde les query params validés pour le controller suivant.
  // On écrase req.query avec les valeurs validées/coercées.
  Object.assign(req.query, result.data);
  return next();
};

module.exports = validateQuery;
