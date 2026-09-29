// app/api/generate-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function POST(request: NextRequest) {
  let browser = null;
  
  try {
    const { html, filename } = await request.json();
    
    if (!html || !filename) {
      return NextResponse.json(
        { error: "Missing html or filename" },
        { status: 400 }
      );
    }
    
    console.log("Generating PDF for:", filename);
    console.log("HTML length:", html.length);
    
    // Puppeteer লঞ্চ করুন
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
    
    const page = await browser.newPage();
    
    // HTML সেট করুন - বড় HTML এর জন্য timeout বাড়ানো হয়েছে
    await page.setContent(html, {
      waitUntil: ["load", "networkidle0"],
      timeout: 30000,
    });
    
    // PDF জেনারেট করুন
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        bottom: "15mm",
        left: "10mm",
        right: "10mm",
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 9px; width: 100%; text-align: center; color: #2563eb; padding-top: 5mm;">
          Attendance Report
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 8px; width: 100%; text-align: center; color: #9ca3af; padding-bottom: 5mm;">
          <span>Generated: ${new Date().toLocaleString()}</span>
          <span style="float: right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });
    
    await browser.close();
    
    console.log("PDF generated successfully, size:", pdfBuffer.length);
    
    // PDF রেসপন্স হিসেবে পাঠান
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
    
  } catch (error) {
    console.error("PDF Generation Error:", error);
    if (browser) await browser.close();
    
    // সবসময় JSON রেসপন্স পাঠান
    return NextResponse.json(
      { 
        error: "PDF generation failed", 
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}