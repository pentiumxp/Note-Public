#!/usr/bin/env python3
"""Render a bounded HTML preview from a DOCX file."""

from __future__ import annotations

import html
import sys
import zipfile
import xml.etree.ElementTree as ET


STYLE = """body { margin: 0; padding: 22px 18px 40px; font-family: "Microsoft YaHei", Arial, sans-serif; color: #16221b; background: #fbfbf8; line-height: 1.72; font-size: 16px; }
p { margin: 0 0 14px; white-space: pre-wrap; overflow-wrap: anywhere; }"""


def render_docx(path: str) -> str:
    with zipfile.ZipFile(path) as archive:
        try:
            xml_bytes = archive.read("word/document.xml")
        except KeyError as exc:
            raise RuntimeError("word_document_missing") from exc

    root = ET.fromstring(xml_bytes)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: list[str] = []

    for paragraph in root.findall(".//w:p", namespace):
        parts: list[str] = []
        for child in paragraph.iter():
            tag = child.tag.rsplit("}", 1)[-1]
            if tag == "t" and child.text:
                parts.append(child.text)
            elif tag == "tab":
                parts.append("    ")
            elif tag == "br":
                parts.append("\n")
        text = "".join(parts).strip()
        if text:
            paragraphs.append(f"<p>{html.escape(text)}</p>")

    if not paragraphs:
        raise RuntimeError("word_text_empty")

    body = "\n".join(paragraphs)
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    {STYLE}
  </style>
</head>
<body>
{body}
</body>
</html>"""


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: render-docx-preview.py <docx>", file=sys.stderr)
        return 2
    try:
        sys.stdout.write(render_docx(argv[1]))
        return 0
    except Exception as error:  # noqa: BLE001 - bounded CLI error for caller.
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
