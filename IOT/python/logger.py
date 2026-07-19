import logging
import sys

def setup_logger(level=logging.INFO):
    """
    Configures logging format for the entire MPU application.
    """
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(levelname)s - [%(threadName)s] - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
