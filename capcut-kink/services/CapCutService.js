/**
 * services/CapCutService.js - Sinkronisasi Alur Indonesia
 */
import { CONFIG } from '../config/config.js';
import { BrowserService } from './BrowserService.js';
import { EmailService } from './EmailService.js';
import { FileService } from './FileService.js';
import { generateRandomBirthday, sleep, formatAccountData } from '../utils/helpers.js';
import chalk from 'chalk';
import ora from 'ora';





export class CapCutService {
  
  static async fillEmail(page, email) {
    const { EMAIL_INPUT, CONTINUE_BUTTON } = CONFIG.CAPCUT.SELECTORS;
    await page.waitForSelector(EMAIL_INPUT, { visible: true });
    await BrowserService.typeIntoField(page, EMAIL_INPUT, email);
    await page.click(CONTINUE_BUTTON);
    console.log(chalk.green('✅ Berhasil mengisi email!'));
  }
  
  /**
 * Fill in password on signup page
 */
static async fillPassword(page, password) {
    try {
      const { PASSWORD_INPUT, SIGNUP_BUTTON } = CONFIG.CAPCUT.SELECTORS;
      
      // Tunggu hingga Gambar 2 muncul
      await page.waitForSelector(PASSWORD_INPUT, { visible: true });
      await BrowserService.typeIntoField(page, PASSWORD_INPUT, password);
      
      // KLIK DAFTAR: Gunakan class dari config, bukan button[type="submit"]
      await BrowserService.clickElement(page, SIGNUP_BUTTON);
      console.log(chalk.green('✅ Berhasil menekan tombol Daftar!'));
      
    } catch (error) {
      console.error(chalk.red('Gagal mengisi password!'));
      throw error;
    }
  }
  
  /**
 * Fill in birthday information (Optimized for UI provided)
 */
static async fillBirthday(page) {
  const birthday = generateRandomBirthday();

  try {
    await sleep(2000); // transisi step sebelumnya

    // ==== Helper: cari target (page atau frame) yang berisi elemen birthday ====
    const findTarget = async () => {
      const yearSelector = 'input[placeholder="Tahun"]';

      if (await page.$(yearSelector)) return page;

      for (const frame of page.frames()) {
        try {
          if (await frame.$(yearSelector)) return frame;
        } catch (_) {}
      }
      return page; // fallback
    };

    const target = await findTarget();

    // ==== Tunggu container birthday muncul dulu (lebih aman) ====
    // kalau class ini berubah, fallback tetap akan jalan karena kita tunggu input Tahun juga
    const containerSel = '.gate_birthday-picker-content';
    if (await target.$(containerSel)) {
      await target.waitForSelector(containerSel, { visible: true, timeout: 30000 });
    }

    // ==== Isi Tahun (pakai placeholder yang stabil) ====
    const YEAR_INPUT = 'input[placeholder="Tahun"]';
    await target.waitForSelector(YEAR_INPUT, { visible: true, timeout: 30000 });

    await target.click(YEAR_INPUT, { clickCount: 3 });
    // bersihin value dengan cepat (lebih konsisten daripada Backspace sekali)
    await target.keyboard.down('Control');
    await target.keyboard.press('A');
    await target.keyboard.up('Control');
    await target.keyboard.press('Backspace');

    await target.type(YEAR_INPUT, String(birthday.year), { delay: 50 });
    await sleep(500);

    // ==== Helper: pilih option dropdown lv-select berdasarkan placeholder ("Bulan"/"Hari") ====
    const selectLvOptionByPlaceholder = async (placeholderText, optionText) => {
      const inputSel = `input[placeholder="${placeholderText}"]`;

      await target.waitForSelector(inputSel, { visible: true, timeout: 30000 });

      // klik dropdown via elemen combobox terdekat dan ambil aria-controls (id popup)
      const controlsId = await target.evaluate((sel) => {
        const input = document.querySelector(sel);
        if (!input) return null;

        const root =
          input.closest('.gate_birthday-picker-selector') ||
          input.closest('.lv-select') ||
          input.parentElement;

        const combobox = root?.querySelector('[role="combobox"]') || root;
        if (!combobox) return null;

        combobox.click();
        return combobox.getAttribute('aria-controls');
      }, inputSel);

      if (!controlsId) throw new Error(`Tidak menemukan aria-controls untuk dropdown "${placeholderText}"`);

      // tunggu popup-nya muncul
      const popupSel = `#${CSS.escape(controlsId)}`;
      await target.waitForSelector(popupSel, { visible: true, timeout: 15000 });

      // klik option berdasarkan teks DI DALAM popup tsb (bukan global)
      const clicked = await target.evaluate(
        ({ popupSelector, text }) => {
          const popup = document.querySelector(popupSelector);
          if (!popup) return false;

          const candidates = Array.from(popup.querySelectorAll('[role="option"], li, div'));
          const el = candidates.find((e) => e.textContent && e.textContent.trim() === String(text).trim());
          if (el) {
            el.click();
            return true;
          }
          return false;
        },
        { popupSelector: popupSel, text: optionText }
      );

      if (!clicked) {
        throw new Error(`Opsi "${optionText}" tidak ditemukan pada dropdown "${placeholderText}"`);
      }

      // tunggu popup menutup (stabil)
      await target.waitForFunction(
        (id) => {
          const el = document.getElementById(id);
          if (!el) return true;
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null;
        },
        { timeout: 15000 },
        controlsId
      );

      await sleep(300);
    };

    // ==== Pilih Bulan dan Hari sesuai UI (Bulan berupa teks Indonesia) ====
    // Pastikan generateRandomBirthday() mengembalikan:
    // - birthday.monthText: "Januari"..."Desember" (REKOMENDASI)
    // atau kalau hanya punya angka 1-12, kita mapping di bawah.
    const monthMap = {
      1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
      5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
      9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
    };

    const monthText = birthday.monthText || monthMap[birthday.month] || String(birthday.month);
    const dayText = String(birthday.day);

    await selectLvOptionByPlaceholder('Bulan', monthText);
    await selectLvOptionByPlaceholder('Hari', dayText);

    // ==== Klik Berikutnya ====
    // Karena selector tombol bisa beda-beda, kita pakai beberapa fallback aman
    const NEXT_BTN_SELECTORS = [
      '.lv_sign_in_panel_wide-primary-button',
      'button.lv_sign_in_panel_wide-primary-button',
      'button:has-text("Berikutnya")',
      'button:has-text("Lanjut")',
      'button:has-text("Continue")',
      '[role="button"]:has-text("Berikutnya")',
    ];

    let nextClicked = false;
    for (const sel of NEXT_BTN_SELECTORS) {
      try {
        const el = await target.$(sel);
        if (el) {
          await el.click();
          nextClicked = true;
          break;
        }
      } catch (_) {}
    }

    if (!nextClicked) {
      // fallback terakhir: cari tombol di DOM via evaluate berdasarkan teks
      const clicked = await target.evaluate(() => {
        const texts = ['Berikutnya', 'Lanjut', 'Continue'];
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const b = btns.find((x) => texts.includes((x.textContent || '').trim()));
        if (b) { b.click(); return true; }
        return false;
      });
      if (!clicked) throw new Error('Tombol Next/Berikutnya tidak ditemukan');
    }

    return birthday;
  } catch (error) {
    throw new Error(`Gagal di Birthday: ${error.message}`);
  }
}
  
  /**
   * Enter OTP code
   */
  static async enterOTP(page, otpCode) {
    try {
      await BrowserService.typeIntoField(page, CONFIG.CAPCUT.SELECTORS.OTP_INPUT, otpCode);
      console.log(chalk.green('✅ Kode OTP dimasukkan dan verifikasi berhasil!'));
    } catch (error) {
      console.error(chalk.red('Gagal memasukkan kode OTP!'));
      throw error;
    }
  }

  /**
   * Create a CapCut account workflow
   */
  static async createAccount(accountNumber, totalAccounts) {
    let browser = null;
    try {
      console.log(chalk.magenta(`\n🚀 Memproses akun ${accountNumber} dari ${totalAccounts}`));

      const browserData = await BrowserService.initializeBrowser();
      browser = browserData.browser;
      const page = browserData.page;

      const email = await EmailService.getNewEmail();
      const password = FileService.getPassword();

      const signupSpinner = ora(chalk.blue('Membuka halaman signup CapCut...')).start();
      await BrowserService.navigateToURL(page, CONFIG.CAPCUT.SIGNUP_URL);
      signupSpinner.succeed(chalk.green('Halaman signup dibuka!'));

      await this.fillEmail(page, email);
      await this.fillPassword(page, password);
      
      // Tahap pengisian tanggal lahir yang sudah disesuaikan UI
      const birthday = await this.fillBirthday(page);

      const otpCode = await EmailService.waitForOTP(email);
      await this.enterOTP(page, otpCode);

      const accountData = formatAccountData(accountNumber, email, password, birthday);
      FileService.saveAccount(accountData);

      await sleep(CONFIG.TIMING.FINAL_WAIT);
      await BrowserService.closeBrowser(browser);

      return { email, password, birthday };
    } catch (error) {
      console.error(chalk.red(`❌ Gagal membuat akun #${accountNumber}:`), error.message);
      if (browser) await BrowserService.closeBrowser(browser);
      return null;
    }
  }

}

















