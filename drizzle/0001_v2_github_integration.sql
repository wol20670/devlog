-- drizzle-kit 생성 후 수동 재정렬: project_repos_project_fk가 참조하는 projects(id,user_id) UNIQUE를 FK보다 먼저 추가
CREATE TABLE "project_repositories" (
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"connected_repository_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_repositories_project_id_connected_repository_id_pk" PRIMARY KEY("project_id","connected_repository_id")
);
--> statement-breakpoint
CREATE TABLE "connected_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"installation_ref" uuid NOT NULL,
	"github_repo_id" bigint NOT NULL,
	"node_id" text NOT NULL,
	"owner_id" bigint NOT NULL,
	"full_name" text NOT NULL,
	"is_private" boolean NOT NULL,
	"default_branch" text NOT NULL,
	"access_state" text DEFAULT 'unknown' NOT NULL,
	"access_reason" text,
	"access_verified_at" timestamp with time zone,
	"access_checked_at" timestamp with time zone,
	"user_permission" text,
	"confirmed_head" text,
	"history_rewritten_at" timestamp with time zone,
	"capped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_repos_user_repo_unique" UNIQUE("user_id","github_repo_id"),
	CONSTRAINT "connected_repos_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "connected_repos_access_state_check" CHECK ("connected_repositories"."access_state" IN ('ok','access_lost','installation_removed','reauth_required','sso_required','unknown'))
);
--> statement-breakpoint
CREATE TABLE "github_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"connected_repository_id" uuid NOT NULL,
	"github_repo_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"external_id" text NOT NULL,
	"node_id" text,
	"number" integer,
	"parent_activity_id" uuid,
	"parent_kind" text,
	"title" text DEFAULT '' NOT NULL,
	"body_excerpt" text DEFAULT '' NOT NULL,
	"state" text,
	"author_github_id" bigint,
	"author_login" text,
	"author_name" text,
	"html_url" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"gh_created_at" timestamp with time zone,
	"gh_updated_at" timestamp with time zone,
	"gh_merged_at" timestamp with time zone,
	"gh_closed_at" timestamp with time zone,
	"merge_commit_sha" text,
	"on_default_branch" boolean DEFAULT false NOT NULL,
	"seen_via_pr" boolean DEFAULT false NOT NULL,
	"is_detached" boolean DEFAULT false NOT NULL,
	"commits_truncated" boolean DEFAULT false NOT NULL,
	"commits_total" integer,
	"reviews_truncated" boolean DEFAULT false NOT NULL,
	"is_private" boolean NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_user_repo_kind_external_unique" UNIQUE("user_id","github_repo_id","kind","external_id"),
	CONSTRAINT "activities_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "activities_id_user_repo_kind_unique" UNIQUE("id","user_id","connected_repository_id","kind"),
	CONSTRAINT "activities_kind_check" CHECK ("github_activities"."kind" IN ('commit','pull_request','issue','review')),
	CONSTRAINT "act_parent_shape" CHECK (("github_activities"."kind" = 'review' AND "github_activities"."parent_activity_id" IS NOT NULL AND "github_activities"."parent_kind" IS NOT NULL AND "github_activities"."parent_kind" = 'pull_request') OR ("github_activities"."kind" <> 'review' AND "github_activities"."parent_activity_id" IS NULL AND "github_activities"."parent_kind" IS NULL)),
	CONSTRAINT "activities_body_excerpt_len_check" CHECK (char_length("github_activities"."body_excerpt") <= 500)
);
--> statement-breakpoint
CREATE TABLE "github_app_user_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"app" text NOT NULL,
	"github_user_id" bigint NOT NULL,
	"enc_access_token" text,
	"enc_refresh_token" text,
	"access_expires_at" timestamp with time zone,
	"refresh_expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credentials_user_app_unique" UNIQUE("user_id","app"),
	CONSTRAINT "credentials_app_check" CHECK ("github_app_user_credentials"."app" IN ('reader','publisher')),
	CONSTRAINT "credentials_status_check" CHECK ("github_app_user_credentials"."status" IN ('active','reauth_required'))
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app" text NOT NULL,
	"installation_id" bigint NOT NULL,
	"account_id" bigint NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"repository_selection" text NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suspended_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installations_app_installation_unique" UNIQUE("app","installation_id"),
	CONSTRAINT "installations_app_check" CHECK ("github_installations"."app" IN ('reader','publisher')),
	CONSTRAINT "installations_selection_check" CHECK ("github_installations"."repository_selection" IN ('all','selected'))
);
--> statement-breakpoint
CREATE TABLE "github_pr_commits" (
	"user_id" text NOT NULL,
	"connected_repository_id" uuid NOT NULL,
	"pr_activity_id" uuid NOT NULL,
	"pr_kind" text DEFAULT 'pull_request' NOT NULL,
	"commit_activity_id" uuid NOT NULL,
	"commit_kind" text DEFAULT 'commit' NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "github_pr_commits_pr_activity_id_commit_activity_id_pk" PRIMARY KEY("pr_activity_id","commit_activity_id"),
	CONSTRAINT "pr_commits_pr_kind_check" CHECK ("github_pr_commits"."pr_kind" = 'pull_request'),
	CONSTRAINT "pr_commits_commit_kind_check" CHECK ("github_pr_commits"."commit_kind" = 'commit')
);
--> statement-breakpoint
CREATE TABLE "github_pr_sync" (
	"pr_activity_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connected_repository_id" uuid NOT NULL,
	"pr_kind" text DEFAULT 'pull_request' NOT NULL,
	"requested_generation" bigint DEFAULT 0 NOT NULL,
	"synced_generation" bigint DEFAULT 0 NOT NULL,
	"synced_for_updated_at" timestamp with time zone,
	"detail_status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_run_after" timestamp with time zone,
	"last_error_kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pr_sync_pr_kind_check" CHECK ("github_pr_sync"."pr_kind" = 'pull_request'),
	CONSTRAINT "pr_sync_detail_status_check" CHECK ("github_pr_sync"."detail_status" IN ('pending','done','error')),
	CONSTRAINT "pr_sync_generation_check" CHECK ("github_pr_sync"."synced_generation" >= 0 AND "github_pr_sync"."synced_generation" <= "github_pr_sync"."requested_generation")
);
--> statement-breakpoint
CREATE TABLE "github_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"connected_repository_id" uuid NOT NULL,
	"resource" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"phase" text DEFAULT 'recent' NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lease_owner" text,
	"lease_token" bigint DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"change_generation" bigint DEFAULT 0 NOT NULL,
	"processed_generation" bigint DEFAULT 0 NOT NULL,
	"pass_generation" bigint,
	"targeted_pr_numbers" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"next_run_after" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error_kind" text,
	"last_error_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"requested_at" timestamp with time zone,
	"items_total" integer,
	"items_processed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_state_repo_resource_unique" UNIQUE("connected_repository_id","resource"),
	CONSTRAINT "sync_state_resource_check" CHECK ("github_sync_state"."resource" IN ('default_branch_commits','pull_requests','pr_details','issues')),
	CONSTRAINT "sync_state_status_check" CHECK ("github_sync_state"."status" IN ('idle','pending','running','blocked','error','complete')),
	CONSTRAINT "sync_state_phase_check" CHECK ("github_sync_state"."phase" IN ('recent','backfill','incremental')),
	CONSTRAINT "sync_state_targeted_resource_check" CHECK ("github_sync_state"."resource" = 'pull_requests' OR cardinality("github_sync_state"."targeted_pr_numbers") = 0),
	CONSTRAINT "sync_state_targeted_max_check" CHECK (cardinality("github_sync_state"."targeted_pr_numbers") <= 100)
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"app" text NOT NULL,
	"event" text NOT NULL,
	"action" text,
	"installation_id" bigint,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_app_check" CHECK ("webhook_deliveries"."app" IN ('reader','publisher'))
);
--> statement-breakpoint
ALTER TABLE "dev_logs" ADD CONSTRAINT "dev_logs_id_user_id_unique" UNIQUE("id","user_id");
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_id_user_id_unique" UNIQUE("id","user_id");
--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repos_project_fk" FOREIGN KEY ("project_id","user_id") REFERENCES "public"."projects"("id","user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repos_repo_fk" FOREIGN KEY ("connected_repository_id","user_id") REFERENCES "public"."connected_repositories"("id","user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "connected_repositories" ADD CONSTRAINT "connected_repositories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "connected_repositories" ADD CONSTRAINT "connected_repos_installation_fk" FOREIGN KEY ("installation_ref") REFERENCES "public"."github_installations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_activities" ADD CONSTRAINT "github_activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_activities" ADD CONSTRAINT "activities_repo_fk" FOREIGN KEY ("connected_repository_id","user_id") REFERENCES "public"."connected_repositories"("id","user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_activities" ADD CONSTRAINT "activities_parent_fk" FOREIGN KEY ("parent_activity_id","user_id","connected_repository_id","parent_kind") REFERENCES "public"."github_activities"("id","user_id","connected_repository_id","kind") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_app_user_credentials" ADD CONSTRAINT "github_app_user_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_commits" ADD CONSTRAINT "pr_commits_pr_fk" FOREIGN KEY ("pr_activity_id","user_id","connected_repository_id","pr_kind") REFERENCES "public"."github_activities"("id","user_id","connected_repository_id","kind") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_commits" ADD CONSTRAINT "pr_commits_commit_fk" FOREIGN KEY ("commit_activity_id","user_id","connected_repository_id","commit_kind") REFERENCES "public"."github_activities"("id","user_id","connected_repository_id","kind") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_sync" ADD CONSTRAINT "pr_sync_pr_fk" FOREIGN KEY ("pr_activity_id","user_id","connected_repository_id","pr_kind") REFERENCES "public"."github_activities"("id","user_id","connected_repository_id","kind") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_sync_state" ADD CONSTRAINT "sync_state_repo_fk" FOREIGN KEY ("connected_repository_id","user_id") REFERENCES "public"."connected_repositories"("id","user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "project_repos_connected_repository_idx" ON "project_repositories" USING btree ("connected_repository_id");
--> statement-breakpoint
CREATE INDEX "connected_repos_github_repo_id_idx" ON "connected_repositories" USING btree ("github_repo_id");
--> statement-breakpoint
CREATE INDEX "connected_repos_installation_ref_idx" ON "connected_repositories" USING btree ("installation_ref");
--> statement-breakpoint
CREATE INDEX "activities_user_repo_occurred_idx" ON "github_activities" USING btree ("user_id","connected_repository_id","occurred_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "activities_user_author_idx" ON "github_activities" USING btree ("user_id","author_github_id");
--> statement-breakpoint
CREATE INDEX "activities_repo_kind_number_idx" ON "github_activities" USING btree ("connected_repository_id","kind","number");
--> statement-breakpoint
CREATE INDEX "activities_parent_idx" ON "github_activities" USING btree ("parent_activity_id");
--> statement-breakpoint
CREATE INDEX "credentials_app_github_user_idx" ON "github_app_user_credentials" USING btree ("app","github_user_id");
--> statement-breakpoint
CREATE INDEX "pr_commits_commit_idx" ON "github_pr_commits" USING btree ("commit_activity_id");
--> statement-breakpoint
CREATE INDEX "pr_sync_pending_idx" ON "github_pr_sync" USING btree ("connected_repository_id","next_run_after") WHERE "github_pr_sync"."requested_generation" > "github_pr_sync"."synced_generation" AND "github_pr_sync"."detail_status" <> 'error';
--> statement-breakpoint
CREATE INDEX "sync_state_status_next_run_idx" ON "github_sync_state" USING btree ("status","next_run_after");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_received_at_idx" ON "webhook_deliveries" USING btree ("received_at");
