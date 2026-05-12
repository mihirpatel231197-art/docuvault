import email
import imaplib
import logging
import os
import tempfile
from email.header import decode_header

from app.core.config import settings
from app.services.watcher import ingest_file

logger = logging.getLogger(__name__)


class EmailIngester:
    """Poll an IMAP mailbox for documents sent via email."""

    def __init__(self, host: str, port: int, username: str, password: str,
                 folder: str = "INBOX", use_ssl: bool = True):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.folder = folder
        self.use_ssl = use_ssl

    def poll(self):
        """Check for new emails with attachments and ingest them."""
        try:
            if self.use_ssl:
                mail = imaplib.IMAP4_SSL(self.host, self.port)
            else:
                mail = imaplib.IMAP4(self.host, self.port)

            mail.login(self.username, self.password)
            mail.select(self.folder)

            _, message_numbers = mail.search(None, "UNSEEN")
            if not message_numbers[0]:
                return 0

            count = 0
            for num in message_numbers[0].split():
                _, msg_data = mail.fetch(num, "(RFC822)")
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                subject = self._decode_header(msg["Subject"]) or "No Subject"
                sender = self._decode_header(msg["From"]) or "Unknown"
                logger.info(f"Processing email: {subject} from {sender}")

                for part in msg.walk():
                    content_disposition = str(part.get("Content-Disposition"))
                    if "attachment" not in content_disposition:
                        continue

                    filename = part.get_filename()
                    if not filename:
                        continue

                    filename = self._decode_header(filename)
                    ext = os.path.splitext(filename)[1].lower()
                    if ext not in {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx", ".txt"}:
                        continue

                    file_data = part.get_payload(decode=True)
                    if not file_data:
                        continue

                    with tempfile.NamedTemporaryFile(
                        suffix=ext, prefix="email_", dir=settings.watch_dir,
                        delete=False
                    ) as tmp:
                        tmp.write(file_data)
                        tmp_path = tmp.name

                    try:
                        # Rename to original filename
                        final_path = os.path.join(settings.watch_dir, filename)
                        if os.path.exists(final_path):
                            base, ext = os.path.splitext(filename)
                            final_path = os.path.join(settings.watch_dir, f"{base}_email{ext}")
                        os.rename(tmp_path, final_path)

                        ingest_file(final_path)
                        count += 1
                        logger.info(f"Ingested attachment: {filename}")
                    except Exception as e:
                        logger.error(f"Failed to ingest {filename}: {e}")
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)

                mail.store(num, "+FLAGS", "\\Seen")

            mail.close()
            mail.logout()
            return count

        except Exception as e:
            logger.error(f"Email polling failed: {e}")
            return 0

    @staticmethod
    def _decode_header(value: str) -> str:
        if not value:
            return ""
        decoded_parts = decode_header(value)
        result = []
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                result.append(part.decode(charset or "utf-8", errors="replace"))
            else:
                result.append(part)
        return " ".join(result)
