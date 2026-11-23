import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { RtiApplicationEntity } from './rti-store.js';

interface PageCursor {
  page: PDFPage;
  y: number;
}

function drawWrappedText(
  cursor: PageCursor,
  pdfDoc: PDFDocument,
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  lineHeight: number,
  color = rgb(0.1, 0.1, 0.1),
  indent = 0
): void {
  const words = text.split(/\s+/);
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      if (cursor.y < 60) {
        cursor.page = pdfDoc.addPage([595.28, 841.89]);
        cursor.y = 790;
      }
      cursor.page.drawText(currentLine, {
        x: 50 + indent,
        y: cursor.y,
        size: fontSize,
        font,
        color,
      });
      cursor.y -= lineHeight;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    if (cursor.y < 60) {
      cursor.page = pdfDoc.addPage([595.28, 841.89]);
      cursor.y = 790;
    }
    cursor.page.drawText(currentLine, {
      x: 50 + indent,
      y: cursor.y,
      size: fontSize,
      font,
      color,
    });
    cursor.y -= lineHeight;
  }
}

export async function generateRtiSection6Pdf(
  application: RtiApplicationEntity
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const initialPage = pdfDoc.addPage([595.28, 841.89]); // A4 in points (210 x 297 mm)

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const cursor: PageCursor = {
    page: initialPage,
    y: 800,
  };

  const primaryColor = rgb(0.08, 0.22, 0.45); // Deep Civic Navy
  const neutralDark = rgb(0.12, 0.12, 0.12);
  const neutralMuted = rgb(0.4, 0.4, 0.4);
  const ruleColor = rgb(0.8, 0.82, 0.85);

  // 1. Header Banner
  cursor.page.drawText("FORM 'A'", {
    x: 50,
    y: cursor.y,
    size: 14,
    font: fontBold,
    color: primaryColor,
  });
  cursor.page.drawText('[See Rule 3(1)]', {
    x: 130,
    y: cursor.y,
    size: 10,
    font: fontRegular,
    color: neutralMuted,
  });
  cursor.y -= 18;

  cursor.page.drawText('STATUTORY APPLICATION UNDER SECTION 6(1)', {
    x: 50,
    y: cursor.y,
    size: 12,
    font: fontBold,
    color: primaryColor,
  });
  cursor.y -= 14;

  cursor.page.drawText('THE RIGHT TO INFORMATION ACT, 2005', {
    x: 50,
    y: cursor.y,
    size: 11,
    font: fontBold,
    color: neutralDark,
  });
  cursor.y -= 10;

  // Horizontal divider rule
  cursor.page.drawLine({
    start: { x: 50, y: cursor.y },
    end: { x: 545, y: cursor.y },
    thickness: 1,
    color: ruleColor,
  });
  cursor.y -= 18;

  // 2. Addressee / Public Authority Block
  cursor.page.drawText('To,', {
    x: 50,
    y: cursor.y,
    size: 10,
    font: fontBold,
    color: neutralDark,
  });
  cursor.y -= 14;

  cursor.page.drawText('The Public Information Officer (PIO) / Assistant PIO,', {
    x: 50,
    y: cursor.y,
    size: 10,
    font: fontRegular,
    color: neutralDark,
  });
  cursor.y -= 14;

  drawWrappedText(
    cursor,
    pdfDoc,
    application.authorityName,
    fontBold,
    10,
    495,
    13,
    neutralDark
  );

  if (application.publicAuthorityAddress) {
    drawWrappedText(
      cursor,
      pdfDoc,
      application.publicAuthorityAddress,
      fontRegular,
      9,
      495,
      12,
      neutralMuted
    );
  }
  cursor.y -= 10;

  // 3. Metadata Reference Box
  cursor.page.drawRectangle({
    x: 50,
    y: cursor.y - 20,
    width: 495,
    height: 24,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: ruleColor,
    borderWidth: 0.5,
  });

  const formattedDate = new Date(application.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  cursor.page.drawText(`RTI Application Ref: ${application.id}`, {
    x: 58,
    y: cursor.y - 13,
    size: 9,
    font: fontBold,
    color: primaryColor,
  });

  cursor.page.drawText(`Filing Date: ${formattedDate}`, {
    x: 430,
    y: cursor.y - 13,
    size: 9,
    font: fontRegular,
    color: neutralMuted,
  });
  cursor.y -= 34;

  // 4. Section 1: Applicant Details
  cursor.page.drawText('1. PARTICULARS OF THE APPLICANT', {
    x: 50,
    y: cursor.y,
    size: 10,
    font: fontBold,
    color: primaryColor,
  });
  cursor.y -= 14;

  const applicantLines = [
    `Full Name: ${application.applicantName}`,
    `Father / Spouse Name: ${application.fatherOrSpouseName || 'N/A'}`,
    `Address for Correspondence: ${application.address}`,
    `Contact Number: ${application.contactNumber}${application.email ? ` | Email: ${application.email}` : ''}`,
  ];

  for (const line of applicantLines) {
    drawWrappedText(cursor, pdfDoc, line, fontRegular, 9, 480, 13, neutralDark, 10);
  }
  cursor.y -= 8;

  // 5. Section 2: Subject & Grievance Context
  cursor.page.drawText('2. PARTICULARS OF INFORMATION REQUIRED UNDER SECTION 6(1)', {
    x: 50,
    y: cursor.y,
    size: 10,
    font: fontBold,
    color: primaryColor,
  });
  cursor.y -= 14;

  drawWrappedText(
    cursor,
    pdfDoc,
    `(a) Subject Matter: ${application.subject}`,
    fontBold,
    9,
    480,
    13,
    neutralDark,
    10
  );

  drawWrappedText(
    cursor,
    pdfDoc,
    `(b) Background & Description: ${application.description}`,
    fontRegular,
    9,
    480,
    13,
    neutralDark,
    10
  );

  if (application.clusterId) {
    drawWrappedText(
      cursor,
      pdfDoc,
      `[Linked Grievance Cluster ID: ${application.clusterId}]`,
      fontBold,
      8.5,
      480,
      12,
      primaryColor,
      10
    );
  }
  cursor.y -= 6;

  // 6. Specific Questions / Points of Information
  drawWrappedText(
    cursor,
    pdfDoc,
    '(c) Specific Points of Official Information Requested:',
    fontBold,
    9,
    480,
    13,
    neutralDark,
    10
  );

  const questions = application.specificQuestions && application.specificQuestions.length > 0
    ? application.specificQuestions
    : [
        'Certified copies of all file notings, inspection reports, and official orders concerning the matter.',
        'Daily progress report and action taken report from submission date to date.',
        'Names and designations of the public servants responsible for resolution.',
      ];

  questions.forEach((q, idx) => {
    drawWrappedText(
      cursor,
      pdfDoc,
      `(${idx + 1}) ${q}`,
      fontRegular,
      9,
      470,
      12.5,
      neutralDark,
      18
    );
  });
  cursor.y -= 10;

  // 7. Section 3: Statutory Declaration & Fees
  cursor.page.drawText('3. STATUTORY DECLARATION & APPLICATION FEES', {
    x: 50,
    y: cursor.y,
    size: 10,
    font: fontBold,
    color: primaryColor,
  });
  cursor.y -= 14;

  const bplText = application.isBplExempt
    ? `Whether Applicant belongs to BPL Category: YES (Card No: ${application.bplCardNo || 'Enclosed'}, Year: ${application.bplYear || 'N/A'}) - Fee Exempted under Section 7(5)`
    : 'Whether Applicant belongs to BPL Category: NO (Application fee of Rs. 10/- paid via IPO / DD / Online Payment Receipt)';

  drawWrappedText(cursor, pdfDoc, bplText, fontRegular, 9, 480, 13, neutralDark, 10);

  const statutoryStatement =
    'Declaration: I hereby state that the information sought above does not fall within the exemptions contained in Section 8 or 9 of the RTI Act, 2005, and to the best of my knowledge pertains to your public authority.';
  drawWrappedText(cursor, pdfDoc, statutoryStatement, fontRegular, 8.5, 480, 12, neutralMuted, 10);
  cursor.y -= 25;

  // 8. Sign-off and Verification Footer
  if (cursor.y < 80) {
    cursor.page = pdfDoc.addPage([595.28, 841.89]);
    cursor.y = 790;
  }

  cursor.page.drawText(`Place: Delhi NCR / Jurisdiction`, {
    x: 50,
    y: cursor.y,
    size: 9,
    font: fontRegular,
    color: neutralDark,
  });
  cursor.page.drawText(`Date: ${formattedDate}`, {
    x: 50,
    y: cursor.y - 14,
    size: 9,
    font: fontRegular,
    color: neutralDark,
  });

  cursor.page.drawText('____________________________________', {
    x: 340,
    y: cursor.y - 6,
    size: 9,
    font: fontRegular,
    color: neutralMuted,
  });
  cursor.page.drawText('Signature / Thumb Impression of Applicant', {
    x: 340,
    y: cursor.y - 18,
    size: 8.5,
    font: fontBold,
    color: neutralDark,
  });

  return pdfDoc.save();
}
