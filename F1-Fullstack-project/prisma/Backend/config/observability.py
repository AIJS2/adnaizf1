import logging
import sys
import os
import sentry_sdk
from loguru import logger
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.loguru import LoguruIntegration

class InterceptHandler(logging.Handler):
    """
    Default handler from examples in loguru documentation.
    It intercepts standard logging messages toward your Loguru sinks.
    """
    def emit(self, record: logging.LogRecord) -> None:
        # Get corresponding Loguru level if it exists.
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )

def setup_observability():
    # 1. Setup Loguru structured logging
    logger.remove() # Remove default console logger
    
    # Format for local dev (colorful and readable)
    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )
    
    logger.add(sys.stderr, format=log_format, level="INFO", colorize=True)
    
    # Format for production (JSON file)
    os.makedirs("logs", exist_ok=True)
    logger.add(
        "logs/app.log",
        rotation="10 MB",
        retention="7 days",
        level="INFO",
        serialize=True # Structured JSON logging
    )

    # Intercept standard logging messages
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    
    for _log in ["uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"]:
        _logger = logging.getLogger(_log)
        _logger.handlers = [InterceptHandler()]
        _logger.propagate = False

    # 2. Setup Sentry
    from dotenv import load_dotenv
    load_dotenv()
    
    sentry_dsn = os.getenv("SENTRY_DSN", "")
    
    if sentry_dsn:
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[
                FastApiIntegration(),
                LoguruIntegration(), # Send loguru error logs to sentry automatically
            ],
            traces_sample_rate=1.0, # Capture 100% of transactions for performance monitoring
            profiles_sample_rate=1.0,
            environment=os.getenv("ENVIRONMENT", "development"),
            send_default_pii=True, # Collect user request headers and IP
        )
        logger.info("Sentry initialized successfully.")
    else:
        logger.warning("SENTRY_DSN not found. Sentry error tracking is disabled. Set SENTRY_DSN environment variable.")
