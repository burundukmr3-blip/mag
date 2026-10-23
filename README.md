# Своя игра

Веб-приложение для проведения «Своей игры» на общем экране: табло, вопросы с картинками и видео, подсчёт очков, финал со ставками и редактор контента. Работает в браузере без интернета, данные хранятся на устройстве ведущего.

## Как смержить

Код приложения лежит в ветке **`feature/svoya-igra`**. Чтобы перенести его в `main`:

**Через сайт GitHub.** Откройте https://github.com/burundukmr3-blip/mag/compare/main...feature/svoya-igra, нажмите **Create pull request**, затем **Merge pull request** и **Confirm merge**.

**Из командной строки:**

```bash
git clone https://github.com/burundukmr3-blip/mag.git
cd mag
git checkout main
git merge origin/feature/svoya-igra
git push origin main
```

## Как запустить

Нужен Node.js 20 или новее ([nodejs.org](https://nodejs.org)).

```bash
npm install
npm start          # сборка и запуск игры: http://localhost:4173
npm run dev        # режим разработки: http://localhost:5173
```

После слияния в этом файле появится полная инструкция: как провести игру, горячие клавиши, редактор, импорт вопросов из таблицы, перенос игры на другое устройство.
