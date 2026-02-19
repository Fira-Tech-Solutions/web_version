/**
 * Console Override for Production
 * Disables console.log in production while keeping error logs
 */

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Override console methods in production
  const originalConsole = { ...console };
  
  // Disable console.log, console.info, console.debug
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  
  // Keep console.warn and console.error for critical issues
  console.warn = (...args: any[]) => {
    // Log warnings to secure logger instead
    try {
      const secureLogger = require('./secure-logger').default;
      secureLogger.logSystemEvent('CONSOLE_WARN', 'WARN', { message: args.join(' ') });
    } catch {
      // Fallback to original if secure logger fails
      originalConsole.warn(...args);
    }
  };
  
  console.error = (...args: any[]) => {
    // Log errors to secure logger instead
    try {
      const secureLogger = require('./secure-logger').default;
      secureLogger.logError('CONSOLE_ERROR', new Error(args.join(' ')));
    } catch {
      // Fallback to original if secure logger fails
      originalConsole.error(...args);
    }
  };
  
  // Export original console for emergency debugging
  (global as any).originalConsole = originalConsole;
}

export {};
