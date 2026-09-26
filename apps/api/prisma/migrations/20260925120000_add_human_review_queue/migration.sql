-- CreateTable changes for pending human-review ownership.
ALTER TABLE "Annotation" DROP CONSTRAINT "Annotation_reviewerId_fkey";

ALTER TABLE "Annotation" ALTER COLUMN "reviewerId" DROP NOT NULL;

CREATE UNIQUE INDEX "Annotation_evaluationId_key" ON "Annotation"("evaluationId");

ALTER TABLE "Annotation"
ADD CONSTRAINT "Annotation_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
