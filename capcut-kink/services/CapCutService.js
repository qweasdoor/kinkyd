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
  const { 
    BIRTHDAY_INPUT, 
    BIRTHDAY_MONTH_SELECTOR, 
    BIRTHDAY_DAY_SELECTOR, 
    BIRTHDAY_NEXT_BUTTON 
  } = CONFIG.CAPCUT.SELECTORS;
  
  const birthday = generateRandomBirthday();

  try {
    // 1. Tunggu transisi halaman Gambar 3 selesai sepenuhnya
    await sleep(3500); 

    // 2. Isi Tahun
    // Tunggu hingga elemen benar-benar siap
    await page.waitForSelector(BIRTHDAY_INPUT, { visible: true, timeout: 15000 });
    
    // Klik elemen untuk memberikan fokus kursor
    await page.click(BIRTHDAY_INPUT);
    
    // Hapus isi jika ada teks tersisa (Backspace 4x untuk tahun)
    for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Backspace');
    }

    // Ketik Tahun
    await page.type(BIRTHDAY_INPUT, String(birthday.year), { delay: 100 });
    await sleep(800);

    // 3. Pilih Bulan (Dropdown)
    await page.click(BIRTHDAY_MONTH_SELECTOR);
    await sleep(1200); 
    await BrowserService.selectDropdownItem(page, birthday.month);
    await sleep(800);

    // 4. Pilih Hari (Dropdown)
    await page.click(BIRTHDAY_DAY_SELECTOR);
    await sleep(1200);
    await BrowserService.selectDropdownItem(page, birthday.day);

    // 5. Klik Tombol Berikutnya
    // Tombol akan aktif (biru) setelah semua data terisi valid
    await sleep(2000); 
    await page.waitForSelector(BIRTHDAY_NEXT_BUTTON, { visible: true });
    await page.click(BIRTHDAY_NEXT_BUTTON);
    
    console.log(chalk.green(`✅ Berhasil melewati tahap Birthday!`));
    return birthday;

  } catch (error) {
    throw new Error(`Gagal pada tahap Birthday: ${error.message}`);
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













