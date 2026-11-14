'use strict';
const words = {
  ru: {
    installTitle: 'Добро пожаловать в Limits',
    installCopy: 'Лимиты ИИ-подписок и время до сброса всегда под рукой.',
    updateTitle: 'Добро пожаловать в новый Limits',
    updateCopy: 'Теперь в Limits доступны квоты Claude Code, Kimi Code и GLM Coding Plan.',
    displayTitle: 'Где смотреть лимиты',
    variants: 'Варианты отображения',
    settingsTitle: 'Обновлённые настройки',
    settingsCopy: 'Подписки, обновления и уведомления о сбросе теперь в отдельных разделах.',
    settings: 'Разделы настроек',
    general: 'Главные', subscriptions: 'Подписки', updates: 'Обновления',
    providersTitle: 'Подключайте свои подписки',
    providersCopy: 'Добавляйте сервисы в настройках и переключайтесь между личным и рабочим аккаунтами.',
    providers: 'Поддерживаемые сервисы',
    skippedTitle: 'Туториал пропущен',
    skippedCopy: 'Нажмите «Продолжить», чтобы открыть Limits.',
    introAlt: 'Панель Limits с остатками за 5 часов и 7 дней',
    step: (position, total) => `Шаг ${position} из ${total}`,
    skip: 'Пропустить', back: 'Назад', next: 'Далее', open: 'Открыть Limits', continue: 'Продолжить',
  },
  en: {
    installTitle: 'Welcome to Limits',
    installCopy: 'See your AI subscription limits and reset times at a glance.',
    updateTitle: 'Welcome to the new Limits',
    updateCopy: 'Limits now tracks quotas for Claude Code, Kimi Code, and GLM Coding Plan.',
    displayTitle: 'Where to see your limits',
    variants: 'Display options',
    settingsTitle: 'Redesigned settings',
    settingsCopy: 'Subscriptions, updates, and reset notifications now have their own sections.',
    settings: 'Settings sections',
    general: 'General', subscriptions: 'Subscriptions', updates: 'Updates',
    providersTitle: 'Connect your subscriptions',
    providersCopy: 'Add services in Settings and switch between your personal and work accounts.',
    providers: 'Supported services',
    skippedTitle: 'Tutorial skipped',
    skippedCopy: 'Select Continue to open Limits.',
    introAlt: 'Limits panel showing the remaining five-hour and weekly quotas',
    step: (position, total) => `Step ${position} of ${total}`,
    skip: 'Skip', back: 'Back', next: 'Next', open: 'Open Limits', continue: 'Continue',
  },
};

function animate(element) {
  element.classList.remove('lt-enter');
  void element.offsetWidth;
  element.classList.add('lt-enter');
}

async function initWelcome() {
  const { language, mode, display, reducedMotion } = await window.limitsWelcome.get();
  const t = words[language];
  document.documentElement.lang = language;
  document.body.toggleAttribute('data-reduced-motion', reducedMotion);
  const image = document.getElementById('lt-shot');
  const settings = document.querySelector('.lt-settings');
  const providers = document.querySelector('.lt-providers');
  const variants = document.getElementById('lt-variants');
  const heading = document.getElementById('lt-heading');
  const description = document.getElementById('lt-description');
  const progress = document.querySelector('.lt-progress');
  const skip = document.querySelector('[data-action="skip"]');
  const back = document.querySelector('[data-action="back"]');
  const next = document.querySelector('[data-action="next"]');
  const nextLabel = document.getElementById('lt-next-label');
  const intro = { src: 'images/intro.png', label: t.introAlt, size: 'panel' };
  const skipped = { src: 'images/limits.png', label: '', size: 'logo' };
  const slides = [
    { title: t[mode + 'Title'], copy: t[mode + 'Copy'], image: intro },
    { title: t.displayTitle, copy: display.description, display: true },
    mode === 'update'
      ? { title: t.settingsTitle, copy: t.settingsCopy, graphic: settings }
      : { title: t.providersTitle, copy: t.providersCopy, graphic: providers },
  ];
  let step = 0;
  let didSkip = false;
  let selectedVariant = 0;

  for (const element of document.querySelectorAll('[data-text]')) element.textContent = t[element.dataset.text];
  for (const [element, label] of [[settings, t.settings], [providers, t.providers], [variants, t.variants], [back, t.back]]) {
    element.setAttribute('aria-label', label);
  }

  function showImage({ src, label, size }) {
    image.src = src;
    image.alt = label;
    image.dataset.size = size;
    animate(image);
  }

  function selectVariant(index) {
    selectedVariant = index;
    variantButtons.forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
    showImage(display.variants[index]);
  }

  const variantButtons = display.variants.map(({ label }, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => selectVariant(index));
    return button;
  });
  variants.append(...variantButtons);

  function render() {
    const slide = didSkip ? { title: t.skippedTitle, copy: t.skippedCopy, image: skipped } : slides[step];
    heading.textContent = slide.title;
    description.textContent = slide.copy;
    settings.hidden = slide.graphic !== settings;
    providers.hidden = slide.graphic !== providers;
    image.hidden = Boolean(slide.graphic);
    variants.hidden = !slide.display;
    if (slide.display) selectVariant(selectedVariant);
    if (slide.image) showImage(slide.image);
    if (slide.graphic) animate(slide.graphic);

    progress.hidden = didSkip;
    progress.setAttribute('aria-label', t.step(step + 1, slides.length));
    [...progress.children].forEach((dot, index) => dot.classList.toggle('lt-current', index === step));
    skip.hidden = didSkip;
    back.hidden = didSkip || step === 0;
    nextLabel.textContent = didSkip ? t.continue : step === slides.length - 1 ? t.open : t.next;
  }

  function skipTour() {
    didSkip = true;
    render();
    next.focus();
  }

  skip.addEventListener('click', skipTour);
  back.addEventListener('click', () => { step--; render(); if (back.hidden) next.focus(); });
  next.addEventListener('click', () => {
    if (didSkip || step === slides.length - 1) {
      void window.limitsWelcome.finish();
      return;
    }
    step++;
    render();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !didSkip) skipTour();
  });
  render();
  await image.decode();
}

window.welcomeReady = initWelcome();
