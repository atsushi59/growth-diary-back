-- CreateTable
CREATE TABLE "growth_standards" (
    "id" SERIAL NOT NULL,
    "gender" TEXT NOT NULL,
    "age_months" INTEGER NOT NULL,
    "metric" TEXT NOT NULL,
    "min" DOUBLE PRECISION NOT NULL,
    "max" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "growth_standards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_standards_gender_age_months_metric_key" ON "growth_standards"("gender", "age_months", "metric");
