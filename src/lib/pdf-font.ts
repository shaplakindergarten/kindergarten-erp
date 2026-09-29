// lib/pdf-font.ts
import jsPDF from "jspdf";

let fontLoaded = false;

export const loadFont = async (doc: jsPDF): Promise<void> => {
  if (fontLoaded) return;
  
  try {
    // পাবলিক ফোল্ডার থেকে ফন্ট লোড করুন
    const response = await fetch("/fonts/SolaimanLipi.ttf");
    const fontData = await response.arrayBuffer();
    
    // ফন্ট অ্যাড করুন (SolaimanLipi নামে)
    doc.addFileToVFS("SolaimanLipi.ttf", btoa(
      String.fromCharCode(...new Uint8Array(fontData))
    ));
    doc.addFont("SolaimanLipi.ttf", "SolaimanLipi", "normal");
    
    fontLoaded = true;
  } catch (error) {
    console.error("Font load error:", error);
    // ব্যাকআপ: ডিফল্ট ফন্ট ব্যবহার করবে (বাংলা কাজ করবে না)
  }
};