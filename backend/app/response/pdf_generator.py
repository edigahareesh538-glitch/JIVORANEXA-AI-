"""Generates one PDF per booking (flight, hotel, bus, food order) plus
a combined all-bookings zip, when the user clicks 'Book My Trip'.
"""
import os
import zipfile
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "generated_pdfs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

ACCENT = colors.HexColor("#7C5CFC")
MUTED = colors.HexColor("#5B6B8C")


def _base_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TicketTitle", fontSize=18, leading=22, textColor=ACCENT, spaceAfter=4))
    styles.add(ParagraphStyle(name="TicketMeta", fontSize=9, textColor=MUTED, spaceAfter=12))
    styles.add(ParagraphStyle(name="TicketLabel", fontSize=9, textColor=MUTED))
    styles.add(ParagraphStyle(name="TicketValue", fontSize=12, textColor=colors.black, spaceAfter=8))
    return styles


def _build_ticket(path: str, title: str, subtitle: str, rows: list[tuple[str, str]], footer: str):
    doc = SimpleDocTemplate(path, pagesize=A5, topMargin=18 * mm, bottomMargin=18 * mm,
                             leftMargin=16 * mm, rightMargin=16 * mm)
    styles = _base_styles()
    story = [
        Paragraph(title, styles["TicketTitle"]),
        Paragraph(subtitle, styles["TicketMeta"]),
    ]
    table_data = [[Paragraph(f"<b>{k}</b>", styles["TicketLabel"]), Paragraph(v, styles["TicketValue"])] for k, v in rows]
    t = Table(table_data, colWidths=[45 * mm, 85 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#E4E7EC")),
    ]))
    story.append(t)
    story.append(Spacer(1, 16))
    story.append(Paragraph(footer, styles["TicketMeta"]))
    doc.build(story)


def generate_booking_pdfs(session_id: str, plan: dict) -> dict:
    """plan is the same dict returned by /api/plan. Returns
    {label: filename, ...} plus writes a session-specific zip."""
    session_dir = os.path.join(OUTPUT_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    files: dict[str, str] = {}

    flight = plan.get("flight") or {}
    _build_ticket(
        os.path.join(session_dir, "flight_ticket.pdf"),
        "Flight Ticket", f"Neural Trip Agent -- Booking confirmation",
        [
            ("Destination", plan.get("destination", "-")),
            ("Airline", flight.get("airline", "-")),
            ("Fare", f"Rs. {flight.get('price', '-')}"),
            ("Duration", f"{flight.get('duration_hr', '-')} h"),
            ("Status", "Confirmed"),
        ],
        "Please arrive at the airport at least 2 hours before departure.",
    )
    files["flight"] = "flight_ticket.pdf"

    hotel = plan.get("hotel") or {}
    booking = hotel.get("booking") or {}
    _build_ticket(
        os.path.join(session_dir, "hotel_confirmation.pdf"),
        "Hotel Booking", "Neural Trip Agent -- Room confirmation",
        [
            ("Hotel", hotel.get("name", "-")),
            ("Rate", f"Rs. {hotel.get('price_per_night', '-')}/night"),
            ("Status", booking.get("status", "confirmed").title()),
            ("Confirmation ID", booking.get("confirmation_id", "N/A")),
        ],
        "Check-in from 12:00 PM. Carry a valid photo ID at the front desk.",
    )
    files["hotel"] = "hotel_confirmation.pdf"

    _build_ticket(
        os.path.join(session_dir, "bus_ticket.pdf"),
        "Bus Ticket", "Neural Trip Agent -- Local transfer booking",
        [
            ("Route", f"Airport -> {plan.get('destination', '-')} city"),
            ("Departure window", "10:00 PM -- 10:30 PM"),
            ("Seat", "Auto-assigned on boarding"),
            ("Status", "Booked"),
        ],
        "Reach the boarding point 15 minutes early.",
    )
    files["bus"] = "bus_ticket.pdf"

    _build_ticket(
        os.path.join(session_dir, "food_order.pdf"),
        "Food Order Status", "Neural Trip Agent -- Delivery scheduled",
        [
            ("Provider", "Swiggy / Zomato"),
            ("Scheduled for", "10:00 PM, on hotel check-in"),
            ("Status", "Scheduled"),
        ],
        "Order will be placed automatically once you check in.",
    )
    files["food"] = "food_order.pdf"

    zip_path = os.path.join(session_dir, "all_bookings.zip")
    with zipfile.ZipFile(zip_path, "w") as zf:
        for label, fname in files.items():
            zf.write(os.path.join(session_dir, fname), arcname=fname)
    files["all_zip"] = "all_bookings.zip"

    return files
