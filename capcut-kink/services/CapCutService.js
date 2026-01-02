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
    // TUNGGU HALAMAN BIRTHDAY
    await page.waitForSelector('text=Kapan tanggal lahir Anda?', { timeout: 20000 });

    // ===== TAHUN =====
    await page.waitForSelector('input[placeholder="Tahun"]', { visible: true });
    await page.click('input[placeholder="Tahun"]', { clickCount: 3 });
    await page.type('input[placeholder="Tahun"]', String(birthday.year), { delay: 80 });

    // ===== BULAN =====
    await page.click('div[role="button"]:has-text("Bulan")');
    await sleep(600);
    await page.click(`li:has-text("${birthday.month}")`);

    // ===== HARI =====
    await page.click('div[role="button"]:has-text("Hari")');
    await sleep(600);
    await page.click(`li:has-text("${birthday.day}")`);

    // ===== BERIKUTNYA =====
    await page.waitForSelector('button:has-text("Berikutnya"):not([disabled])');
    await page.click('button:has-text("Berikutnya")');

    console.log(chalk.green('🎂 Birthday berhasil diisi'));
    return birthday;

  } catch (err) {
    throw new Error(`Gagal di tahap Birthday (UI berubah): ${err.message}`);
  }
}
  
  /**
   * Helper: Mencari dan mengeklik item di dalam dropdown berdasarkan teks
   */
 static async clickItemByText(page, text) {
    return await page.evaluate((t) => {
      const items = Array.from(document.querySelectorAll('li, [role="option"]'));
      const found = items.find(el => el.textContent.trim() === t);
      if (found) { found.click(); return true; }
      return false;
    }, String(text));
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









