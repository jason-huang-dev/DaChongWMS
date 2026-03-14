from __future__ import annotations

import time

from django.core.management.base import BaseCommand

from automation.services import run_background_tasks


class Command(BaseCommand):
    help = "Run the database-backed background worker"

    def add_arguments(self, parser) -> None:
        parser.add_argument("--once", action="store_true", help="Run a single worker cycle and exit")
        parser.add_argument("--limit", type=int, default=10, help="Maximum tasks to process per cycle")
        parser.add_argument("--sleep-seconds", type=int, default=5, help="Sleep interval between cycles")
        parser.add_argument("--worker-name", type=str, default="cli-worker", help="Logical worker name")

    def handle(self, *args, **options):
        worker_name = options["worker_name"]
        limit = options["limit"]
        if options["once"]:
            processed = run_background_tasks(worker_name=worker_name, limit=limit, include_schedules=True)
            self.stdout.write(self.style.SUCCESS(f"Processed {processed} background task(s)"))
            return

        while True:
            processed = run_background_tasks(worker_name=worker_name, limit=limit, include_schedules=True)
            self.stdout.write(f"Processed {processed} background task(s)")
            time.sleep(max(options["sleep_seconds"], 1))
