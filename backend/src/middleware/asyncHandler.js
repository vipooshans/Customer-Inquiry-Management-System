// Express 4 does not catch errors from async handlers: a rejected promise would
// hang the request. This wrapper forwards any thrown error to the error handler.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
