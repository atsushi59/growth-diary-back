-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "birthday" DATE NOT NULL,
    "gender" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth" (
    "id" SERIAL NOT NULL,
    "child_id" INTEGER NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccine_master" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "dose_number" INTEGER NOT NULL,
    "min_start_month" INTEGER NOT NULL,
    "standard_month" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "vaccine_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_records" (
    "id" SERIAL NOT NULL,
    "child_id" INTEGER NOT NULL,
    "vaccine_id" INTEGER NOT NULL,
    "vaccinated_at" DATE NOT NULL,

    CONSTRAINT "vaccination_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" SERIAL NOT NULL,
    "child_id" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_master" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_month" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "food_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_records" (
    "id" SERIAL NOT NULL,
    "child_id" INTEGER NOT NULL,
    "food_id" INTEGER NOT NULL,
    "has_eaten" BOOLEAN NOT NULL DEFAULT false,
    "eaten_at" DATE,

    CONSTRAINT "food_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_posts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_comments" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_likes" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "children_user_id_idx" ON "children"("user_id");

-- CreateIndex
CREATE INDEX "growth_child_id_idx" ON "growth"("child_id");

-- CreateIndex
CREATE INDEX "vaccination_records_child_id_idx" ON "vaccination_records"("child_id");

-- CreateIndex
CREATE INDEX "vaccination_records_vaccine_id_idx" ON "vaccination_records"("vaccine_id");

-- CreateIndex
CREATE INDEX "albums_child_id_idx" ON "albums"("child_id");

-- CreateIndex
CREATE INDEX "food_records_child_id_idx" ON "food_records"("child_id");

-- CreateIndex
CREATE INDEX "food_records_food_id_idx" ON "food_records"("food_id");

-- CreateIndex
CREATE INDEX "recipe_posts_user_id_idx" ON "recipe_posts"("user_id");

-- CreateIndex
CREATE INDEX "recipe_comments_post_id_idx" ON "recipe_comments"("post_id");

-- CreateIndex
CREATE INDEX "recipe_comments_user_id_idx" ON "recipe_comments"("user_id");

-- CreateIndex
CREATE INDEX "recipe_likes_post_id_idx" ON "recipe_likes"("post_id");

-- CreateIndex
CREATE INDEX "recipe_likes_user_id_idx" ON "recipe_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_likes_post_id_user_id_key" ON "recipe_likes"("post_id", "user_id");

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth" ADD CONSTRAINT "growth_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_vaccine_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccine_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_records" ADD CONSTRAINT "food_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_records" ADD CONSTRAINT "food_records_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_posts" ADD CONSTRAINT "recipe_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_comments" ADD CONSTRAINT "recipe_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "recipe_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_comments" ADD CONSTRAINT "recipe_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_likes" ADD CONSTRAINT "recipe_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "recipe_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_likes" ADD CONSTRAINT "recipe_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
