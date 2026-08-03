from __future__ import annotations

from typing import Final

from test_tool import post_chat

PROMPT: Final = "What time is it today? Use browser tools before answering."

if __name__ == "__main__":
    post_chat(PROMPT)
