class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  console.error('错误:', err);

  res.status(err.statusCode).json({
    code: err.statusCode,
    status: err.status,
    message: err.message || '服务器内部错误'
  });
};

module.exports = { AppError, errorHandler };
