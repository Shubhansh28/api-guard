const { ApiGuardError, errorHandler, formatErrorResponse } = require('../src');

function run(error, exposeDetails = true) {
  const output = {};
  const res = {
    headersSent: false,
    status(code) { output.status = code; return this; },
    json(body) { output.body = body; return this; }
  };
  errorHandler({ exposeDetails })(error, {}, res, (nextError) => { output.nextError = nextError; });
  return output;
}

describe('errorHandler', () => {
  it('formats package errors and sanitizes unknown errors', () => {
    expect(run(new ApiGuardError('CUSTOM', 'Nope', 418, { field: 'x' })).body)
      .toEqual(formatErrorResponse('CUSTOM', 'Nope', { field: 'x' }));
    const unknown = run(new Error('secret internals'));
    expect(unknown.status).toBe(500);
    expect(unknown.body).toEqual(formatErrorResponse('INTERNAL_ERROR', 'Internal server error'));
    expect(JSON.stringify(unknown.body)).not.toContain('secret');
  });

  it('validates options and delegates when headers were sent', () => {
    expect(() => errorHandler({ exposeDetails: 'yes' })).toThrow();
    const nextError = new Error('already sent');
    const output = {};
    const res = { headersSent: true };
    errorHandler()(nextError, {}, res, (error) => { output.error = error; });
    expect(output.error).toBe(nextError);
  });
});
