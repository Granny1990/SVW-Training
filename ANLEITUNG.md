# Admin-Zugang einrichten (einmalig, ca. 10 Minuten)

Die Admin-Seite speichert direkt in das Google Sheet. Dafür braucht das Sheet ein kleines Google-Skript.

## 1. Sheet in eine Google-Tabelle umwandeln
Die hochgeladene Datei ist noch eine Excel-Datei. Skripte gehen nur mit echten Google-Tabellen.
1. Die Datei in Google Drive öffnen.
2. **Datei → Als Google Tabellen speichern**. Es entsteht eine Kopie. Ab jetzt nur noch mit dieser Kopie arbeiten.

## 2. Skript einfügen
1. In der neuen Google-Tabelle: **Erweiterungen → Apps Script**.
2. Den vorhandenen Inhalt von `Code.gs` löschen und den Inhalt von [`google-skript/Code.gs`](google-skript/Code.gs) einfügen.
3. Oben bei `ADMINS` die Namen und Passwörter eintragen, zum Beispiel:
   ```js
   const ADMINS = {
     "Jan": "ein-langes-passwort",
     "Platzwart": "ein-anderes-passwort"
   };
   ```
4. Links auf das Zahnrad **Projekteinstellungen** gehen und als Zeitzone **(GMT+01:00) Berlin** wählen.
5. Speichern (Disketten-Symbol).

## 3. Als Web-App bereitstellen
1. Oben rechts: **Bereitstellen → Neue Bereitstellung**.
2. Beim Zahnrad „Typ auswählen“ **Web-App** wählen.
3. Ausführen als: **Ich**. Zugriff: **Jeder**.
4. **Bereitstellen** klicken und den Zugriff erlauben. Bei „Google hat diese App nicht überprüft“ auf **Erweitert → Zu … wechseln** klicken. Das ist dein eigenes Skript.
5. Die **Web-App-URL** kopieren (endet auf `/exec`).

## 4. Link eintragen
In `config.js` bei `SCRIPT_URL` die Web-App-URL eintragen (oder sie Claude schicken).

## Danach
- Öffentlicher Plan: https://granny1990.github.io/svw-training/
- Admin: https://granny1990.github.io/svw-training/admin.html
- Wer wann gespeichert hat, steht im Blatt **Protokoll**.
- Passwort ändern oder Person hinzufügen: in `Code.gs` bei `ADMINS` ändern, dann **Bereitstellen → Bereitstellungen verwalten → Stift → Version: Neue Version → Bereitstellen**. Der Link bleibt gleich.

## Skript aktualisieren (Spiele und 90 Minuten)
Für Spiele braucht das Sheet zwei neue Spalten (**Art**, **Gegner**). Die legt das neue Skript selbst an.
1. In der Google-Tabelle: **Erweiterungen → Apps Script**.
2. Ganz oben die Zeilen mit `ADMINS` (Namen und Passwörter) kopieren und zur Seite legen.
3. Den Inhalt von `Code.gs` komplett durch [`google-skript/Code.gs`](google-skript/Code.gs) ersetzen und die `ADMINS`-Zeilen wieder einfügen. Speichern.
4. **Bereitstellen → Bereitstellungen verwalten → Stift → Version: Neue Version → Bereitstellen**. Der Link bleibt gleich.
5. Einmalig 75 → 90 Minuten: Oben in der Funktionsauswahl **trainingsAuf90Minuten** wählen und **Ausführen**. Im Ausführungsprotokoll steht, wie viele Trainings umgestellt wurden. Danach nicht noch einmal nötig.

Bis Schritt 4 erledigt ist, kann die Admin-Seite nur Trainings speichern (die Auswahl „Spiel“ ist ausgegraut).
