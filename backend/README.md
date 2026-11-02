## INSTALL THE DEPENDENCIES
- npm i express nodemon cors bcryptjs jsonwebtoken dotenv

## Backfill existing clubs
Run `npm run backfill:clubs` from `backend/` to preview clubs missing `collegeId` or `isCentral`. Add `-- --apply` to write the defaults; without that flag, the script is dry-run only.