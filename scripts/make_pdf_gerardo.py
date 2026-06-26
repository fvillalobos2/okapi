#!/usr/bin/env python3
"""Generate professional PDF report for Gerardo Chaves from markdown."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame
from reportlab.pdfgen import canvas
import re
from datetime import datetime

# ── Colors ────────────────────────────────────────────────────────────────────
DARK_BLUE   = HexColor('#1a3a5c')
MID_BLUE    = HexColor('#2c5f8a')
LIGHT_BLUE  = HexColor('#e8f0f7')
ACCENT      = HexColor('#c8a84b')   # gold accent
GRAY_TEXT   = HexColor('#444444')
LIGHT_GRAY  = HexColor('#f5f5f5')
MID_GRAY    = HexColor('#cccccc')

INPUT_MD  = "/Users/fvlllbs/Claude Okapi/innova_reporte_gerardo.md"
OUTPUT_PDF = "/Users/fvlllbs/Claude Okapi/innova_reporte_gerardo.pdf"

# ── Page numbering ────────────────────────────────────────────────────────────
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_footer(self, page_count):
        if self._pageNumber == 1:
            return
        self.saveState()
        self.setFillColor(MID_GRAY)
        self.setFont('Helvetica', 8)
        self.drawString(inch, 0.5 * inch, "Innova — Confidencial")
        self.drawRightString(letter[0] - inch, 0.5 * inch,
                             f"Página {self._pageNumber - 1} de {page_count - 1}")
        self.setStrokeColor(MID_GRAY)
        self.setLineWidth(0.5)
        self.line(inch, 0.65 * inch, letter[0] - inch, 0.65 * inch)
        self.restoreState()


def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle('ReportTitle',
        fontName='Helvetica-Bold', fontSize=28, textColor=white,
        alignment=TA_CENTER, spaceAfter=8, leading=34))

    styles.add(ParagraphStyle('ReportSubtitle',
        fontName='Helvetica', fontSize=13, textColor=HexColor('#c8d8e8'),
        alignment=TA_CENTER, spaceAfter=6))

    styles.add(ParagraphStyle('CoverDate',
        fontName='Helvetica', fontSize=11, textColor=HexColor('#a0b8cc'),
        alignment=TA_CENTER, spaceAfter=0))

    styles.add(ParagraphStyle('H1',
        fontName='Helvetica-Bold', fontSize=16, textColor=DARK_BLUE,
        spaceBefore=20, spaceAfter=8, leading=20,
        borderPad=4))

    styles.add(ParagraphStyle('H2',
        fontName='Helvetica-Bold', fontSize=12, textColor=MID_BLUE,
        spaceBefore=14, spaceAfter=6, leading=16))

    styles.add(ParagraphStyle('H3',
        fontName='Helvetica-Bold', fontSize=10, textColor=DARK_BLUE,
        spaceBefore=10, spaceAfter=4, leading=14))

    styles.add(ParagraphStyle('Body',
        fontName='Helvetica', fontSize=10, textColor=GRAY_TEXT,
        alignment=TA_JUSTIFY, spaceAfter=8, leading=15))

    styles.add(ParagraphStyle('BulletItem',
        fontName='Helvetica', fontSize=10, textColor=GRAY_TEXT,
        alignment=TA_LEFT, spaceAfter=4, leading=14,
        leftIndent=16, firstLineIndent=0))

    styles.add(ParagraphStyle('Bold',
        fontName='Helvetica-Bold', fontSize=10, textColor=GRAY_TEXT,
        alignment=TA_JUSTIFY, spaceAfter=6, leading=15))

    styles.add(ParagraphStyle('Quote',
        fontName='Helvetica-Oblique', fontSize=10, textColor=MID_BLUE,
        alignment=TA_LEFT, spaceAfter=8, leading=14,
        leftIndent=24, rightIndent=24,
        borderColor=MID_BLUE, borderWidth=0, borderPad=0))

    return styles


def build_cover(story, styles):
    """Full-page cover using a colored table."""
    cover_data = [[
        Paragraph("INNOVA", ParagraphStyle('Brand',
            fontName='Helvetica-Bold', fontSize=11, textColor=ACCENT,
            alignment=TA_CENTER, spaceAfter=30, letterSpacing=4)),
    ]]
    # We'll draw the cover as a big colored block
    cover = Table([
        [Paragraph("Informe de<br/>Servicio al Cliente", styles['ReportTitle'])],
        [Spacer(1, 0.15*inch)],
        [HRFlowable(width="60%", thickness=1.5, color=ACCENT, spaceAfter=16)],
        [Paragraph("Preparado para: <b>Gerardo Chaves</b>", styles['ReportSubtitle'])],
        [Paragraph("Fundador y Director General — Innova", styles['ReportSubtitle'])],
        [Spacer(1, 0.1*inch)],
        [Paragraph(datetime.now().strftime("%d de %B de %Y"), styles['CoverDate'])],
    ], colWidths=[6.5*inch])

    cover.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), DARK_BLUE),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,0), 2.2*inch),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 2.5*inch),
        ('LEFTPADDING', (0,0), (-1,-1), 36),
        ('RIGHTPADDING', (0,0), (-1,-1), 36),
    ]))

    story.append(cover)
    story.append(PageBreak())


def parse_markdown(md_text, styles):
    """Convert markdown to ReportLab flowables."""
    story = []
    lines = md_text.split('\n')
    i = 0

    # Skip the first H1 (title already on cover) and metadata lines
    while i < len(lines):
        line = lines[i]

        # Skip the document title and metadata lines at top
        if line.startswith('# Informe de Servicio') or line.startswith('### Preparado') or \
           line.startswith('### Fecha') or line == '---':
            i += 1
            continue

        # H2 — main section headers
        if line.startswith('## '):
            text = line[3:].strip()
            story.append(Spacer(1, 0.1*inch))
            # Blue bar + title
            bar = Table([[Paragraph(text, ParagraphStyle('H1bar',
                fontName='Helvetica-Bold', fontSize=14, textColor=white,
                spaceAfter=0, leading=18))]],
                colWidths=[6.5*inch])
            bar.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), DARK_BLUE),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('LEFTPADDING', (0,0), (-1,-1), 12),
                ('RIGHTPADDING', (0,0), (-1,-1), 12),
            ]))
            story.append(bar)
            story.append(Spacer(1, 0.1*inch))
            i += 1
            continue

        # H3 — sub-section
        if line.startswith('### '):
            text = line[4:].strip()
            story.append(Paragraph(text, styles['H2']))
            story.append(HRFlowable(width="100%", thickness=0.5,
                                     color=LIGHT_BLUE, spaceAfter=4))
            i += 1
            continue

        # H4 — bold subheading
        if line.startswith('#### '):
            text = line[5:].strip()
            story.append(Paragraph(text, styles['H3']))
            i += 1
            continue

        # Blockquote
        if line.startswith('> '):
            text = line[2:].strip()
            text = process_inline(text)
            box = Table([[Paragraph(f'"{text}"', ParagraphStyle('QBox',
                fontName='Helvetica-Oblique', fontSize=10, textColor=MID_BLUE,
                alignment=TA_JUSTIFY, leading=14, spaceAfter=0))]],
                colWidths=[5.9*inch])
            box.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), LIGHT_BLUE),
                ('LEFTPADDING', (0,0), (-1,-1), 16),
                ('RIGHTPADDING', (0,0), (-1,-1), 16),
                ('TOPPADDING', (0,0), (-1,-1), 10),
                ('BOTTOMPADDING', (0,0), (-1,-1), 10),
                ('LINEAFTER', (0,0), (0,-1), 3, MID_BLUE),
            ]))
            story.append(box)
            story.append(Spacer(1, 6))
            i += 1
            continue

        # Bullet
        if line.startswith('- ') or line.startswith('* '):
            text = line[2:].strip()
            text = process_inline(text)
            story.append(Paragraph(f"• {text}", styles['BulletItem']))
            i += 1
            continue

        # Numbered list
        if re.match(r'^\d+\. ', line):
            text = re.sub(r'^\d+\. ', '', line).strip()
            text = process_inline(text)
            num = re.match(r'^(\d+)', line).group(1)
            story.append(Paragraph(f"<b>{num}.</b> {text}", styles['BulletItem']))
            i += 1
            continue

        # Horizontal rule
        if line.strip() in ('---', '***', '___'):
            story.append(Spacer(1, 8))
            story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GRAY))
            story.append(Spacer(1, 8))
            i += 1
            continue

        # Empty line
        if line.strip() == '':
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Normal paragraph
        text = process_inline(line.strip())
        if text:
            # Check if it's all bold (bold label line)
            if text.startswith('<b>') and text.count('<b>') == 1:
                story.append(Paragraph(text, styles['Bold']))
            else:
                story.append(Paragraph(text, styles['Body']))

        i += 1

    return story


def process_inline(text):
    """Convert markdown inline formatting to ReportLab XML."""
    # Bold+italic ***text***
    text = re.sub(r'\*\*\*(.*?)\*\*\*', r'<b><i>\1</i></b>', text)
    # Bold **text**
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # Italic *text*
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    # Inline code `text`
    text = re.sub(r'`(.*?)`', r'<font name="Courier" size="9">\1</font>', text)
    # Escape & < > that aren't our tags
    # (already handled by reportlab for plain text, but be safe)
    return text


def main():
    with open(INPUT_MD, encoding='utf-8') as f:
        md = f.read()

    styles = build_styles()

    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=letter,
        leftMargin=inch, rightMargin=inch,
        topMargin=inch, bottomMargin=0.85*inch,
        title="Informe de Servicio al Cliente — Innova",
        author="Okapi Analytics",
        subject="Análisis de Conversaciones de Ventas"
    )

    story = []
    build_cover(story, styles)
    story.extend(parse_markdown(md, styles))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generado → {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
