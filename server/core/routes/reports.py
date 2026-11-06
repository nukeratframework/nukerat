from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.reports.core import (
    fetch_reports,
    get_report_download,
    get_report_view,
    main_reports,
    remove_report,
)
from schemas.reports import CreateReportRequest, ReportTag

router = APIRouter()


@router.get("/")
async def list_reports(request: Request):
    # Entrypoint that lists the reports
    try:
        return await fetch_reports()
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.post("/")
async def root(request: Request, body: CreateReportRequest):
    # Entrypoint that creates a report
    try:
        return await main_reports(body.model_dump())
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.get("/{tag}/download")
async def download(request: Request, tag: ReportTag):
    # Entrypoint that downloads a report
    try:
        return await get_report_download(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.get("/{tag}/view")
async def view(request: Request, tag: ReportTag):
    # Entrypoint that returns the report view
    try:
        return await get_report_view(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: ReportTag):
    # Entrypoint that deletes a report
    try:
        return await remove_report(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
