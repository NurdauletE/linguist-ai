@echo off
chcp 65001 >nul
title Установщик — Linguist AI
cd /d "%~dp0"

echo.
echo ========================================
echo   Установщик Linguist AI
echo ========================================
echo.

REM Проверка Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] Node.js не найден.
    echo.
    echo Установите Node.js LTS с https://nodejs.org/
    echo После установки перезапустите этот скрипт.
    echo.
    pause
    exit /b 1
)

REM Проверка npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] npm не найден. Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v 2^>nul') do set NODEVER=%%i
for /f "tokens=*" %%i in ('npm -v 2^>nul') do set NPMVER=%%i
echo [OK] Node.js %NODEVER%
echo [OK] npm %NPMVER%
echo.

REM Установка зависимостей
echo Установка зависимостей (npm install)...
echo Это может занять 1-3 минуты...
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ОШИБКА] Не удалось установить зависимости.
    pause
    exit /b 1
)
echo.
echo [OK] Зависимости установлены.
echo.

REM Создание .env.local из шаблона, если его нет
if not exist ".env.local" (
    if exist ".env.example" (
        echo Создание .env.local из шаблона...
        copy .env.example .env.local >nul
        echo [OK] Файл .env.local создан.
        echo.
        echo ВАЖНО: Откройте .env.local и укажите ваш DEEPSEEK_API_KEY.
        echo Получить ключ: https://platform.deepseek.com/
        echo.
    ) else (
        echo [ВНИМАНИЕ] .env.local не найден. Создайте его вручную с ключом DEEPSEEK_API_KEY.
        echo.
    )
) else (
    echo [OK] .env.local уже существует.
    echo.
)

REM Очистка кэша сборки (опционально, для чистого старта)
if exist ".next" (
    echo Очистка кэша сборки...
    rmdir /s /q .next 2>nul
    echo [OK] Кэш очищен.
    echo.
)

echo ========================================
echo   Установка завершена успешно
echo ========================================
echo.
echo Теперь запустите проект:
echo   - Запуск Linguist AI.bat
echo   или
echo   - npm run dev
echo.
echo Для работы Speech-to-Text используйте Chrome или Edge.
echo.
pause
