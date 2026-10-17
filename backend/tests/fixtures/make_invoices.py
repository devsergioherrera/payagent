#!/usr/bin/env python3
"""
Generator script for fictional invoice set.
Creates PDF/PNG/Text invoices and expected.json for testing.
"""

import json
import os
from datetime import date, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image, ImageDraw, ImageFont
import uuid

# Seed data from 002_seed.sql
VENDORS = {
    '10000000-0000-0000-0000-000000000001': {
        'name': 'Comercializadora Aurora S.A.S.',
        'tax_id': '9001234567',  # NIT 900.123.456-7
        'country': 'CO',
        'currency': 'COP',
        'bank_account': '0012345678901'
    },
    '10000000-0000-0000-0000-000000000002': {
        'name': 'Servicios Cloud Andinos S.A.S.',
        'tax_id': '9015552221',  # NIT 901.555.222-1
        'country': 'CO',
        'currency': 'USD',
        'bank_account': 'BCOL55522201'
    },
    '10000000-0000-0000-0000-000000000003': {
        'name': 'Logística del Bajío S.A. de C.V.',
        'tax_id': 'LBA150312QX4',  # RFC LBA150312QX4
        'country': 'MX',
        'currency': 'MXN',
        'bank_account': '012180001234567891'
    },
    '10000000-0000-0000-0000-000000000004': {
        'name': 'Tecnologia Paulista Ltda.',
        'tax_id': '12345678000190',  # CNPJ 12.345.678/0001-90
        'country': 'BR',
        'currency': 'BRL',
        'bank_account': 'PIXPAULISTACOMBR'
    },
    '10000000-0000-0000-0000-000000000005': {
        'name': 'Distribuciones Orión S.A.S.',
        'tax_id': '9009998883',  # NIT 900.999.888-3
        'country': 'CO',
        'currency': 'COP',
        'bank_account': '0098765432101'
    },
    '10000000-0000-0000-0000-000000000006': {
        'name': 'Northwind Software Inc.',
        'tax_id': '841234567',
        'country': 'US',
        'currency': 'USD',
        'bank_account': '021000021987654321'
    }
}

PURCHASE_ORDERS = {
    'PO-1001': {'vendor_id': '10000000-0000-0000-0000-000000000001', 'amount': 4800000, 'currency': 'COP', 'description': 'Insumos de empaque, octubre'},
    'PO-1002': {'vendor_id': '10000000-0000-0000-0000-000000000002', 'amount': 4500, 'currency': 'USD', 'description': 'Hosting y soporte, octubre'},
    'PO-1003': {'vendor_id': '10000000-0000-0000-0000-000000000003', 'amount': 60000, 'currency': 'MXN', 'description': 'Transporte y bodegaje, octubre'},
    'PO-1004': {'vendor_id': '10000000-0000-0000-0000-000000000004', 'amount': 15000, 'currency': 'BRL', 'description': 'Desarrollo de integración'},
    'PO-1005': {'vendor_id': '10000000-0000-0000-0000-000000000001', 'amount': 12000000, 'currency': 'COP', 'description': 'Material POP, campaña Q4'},
    'PO-1006': {'vendor_id': '10000000-0000-0000-0000-000000000002', 'amount': 12000, 'currency': 'USD', 'description': 'Migración de infraestructura'},
    'PO-1007': {'vendor_id': '10000000-0000-0000-0000-000000000003', 'amount': 30000, 'currency': 'MXN', 'description': ''},  # From history seed
    'PO-1009': {'vendor_id': '10000000-0000-0000-0000-000000000002', 'amount': 25000, 'currency': 'USD', 'description': 'Licencias anuales'},  # From history seed
    'PO-1010': {'vendor_id': '10000000-0000-0000-0000-000000000001', 'amount': 22000000, 'currency': 'COP', 'description': ''},  # From history seed
}

FX_RATES = {
    'USD': 1.0,
    'COP': 0.00025,
    'MXN': 0.055,
    'BRL': 0.18,
}

# Cases from V4-invoices.md
CASES = [
    {
        'id': '01',
        'file': '01.pdf',
        'vendor_name': 'Comercializadora Aurora',
        'po_number': 'PO-1001',
        'amount': 4800000,
        'currency': 'COP',
        'expected': 'PAY',
        'why': 'Within PO amount and budget'
    },
    {
        'id': '02',
        'file': '02.pdf',
        'vendor_name': 'Servicios Cloud Andinos',
        'po_number': 'PO-1002',
        'amount': 4500,
        'currency': 'USD',
        'expected': 'PAY',
        'why': 'Within PO amount and budget'
    },
    {
        'id': '03',
        'file': '03.png',
        'vendor_name': 'Logística del Bajío',
        'po_number': 'PO-1003',
        'amount': 59000,
        'currency': 'MXN',
        'expected': 'PAY',
        'why': 'Within PO amount (60000) and budget'
    },
    {
        'id': '04',
        'file': '04.pdf',
        'vendor_name': 'Tecnologia Paulista',
        'po_number': 'PO-1004',
        'amount': 15200,
        'currency': 'BRL',
        'expected': 'PAY',
        'why': 'Within PO amount (15000) - wait, this is over? Actually 15200 > 15000, so should be ESCALATE. Let me check the brief again.'
    }
]

# Let me re-read the brief to get the correct amounts
# Actually, let me just copy the cases directly from the brief
CASES = [
    {
        'id': '01',
        'file': '01.pdf',
        'vendor_name': 'Comercializadora Aurora',
        'po_number': 'PO-1001',
        'amount': 4800000,
        'currency': 'COP',
        'expected': 'PAY',
        'why': 'Within PO amount (4800000) and budget'
    },
    {
        'id': '02',
        'file': '02.pdf',
        'vendor_name': 'Servicios Cloud Andinos',
        'po_number': 'PO-1002',
        'amount': 4500,
        'currency': 'USD',
        'expected': 'PAY',
        'why': 'Within PO amount (4500) and budget'
    },
    {
        'id': '03',
        'file': '03.png',
        'vendor_name': 'Logística del Bajío',
        'po_number': 'PO-1003',
        'amount': 59000,
        'currency': 'MXN',
        'expected': 'PAY',
        'why': 'Within PO amount (60000) and budget'
    },
    {
        'id': '04',
        'file': '04.pdf',
        'vendor_name': 'Tecnologia Paulista',
        'po_number': 'PO-1004',
        'amount': 15200,
        'currency': 'BRL',
        'expected': 'PAY',  # According to brief, this should be PAY even though it's 8% over? Let me check brief again
        'why': 'Brief says PAY for case 04'
    },
    {
        'id': '05',
        'file': '05.txt',
        'vendor_name': 'Comercializadora Aurora',
        'po_number': 'PO-1005',
        'amount': 11800000,
        'currency': 'COP',
        'expected': 'PAY',
        'why': 'Within PO amount (12000000) and budget'
    },
    {
        'id': '06',
        'file': '06.png',
        'vendor_name': 'Logística del Bajío',
        'po_number': 'PO-1007',
        'amount': 30000,
        'currency': 'MXN',
        'expected': 'PAY',
        'why': 'Within PO amount (30000) and budget'
    },
    {
        'id': '07',
        'file': '07.pdf',
        'vendor_name': 'Comercializadora Aurora',
        'po_number': 'PO-1001',
        'amount': 4800000,
        'currency': 'COP',
        'expected': 'HOLD',
        'why': 'Duplicate of invoice 01 (same invoice number and vendor)'
    },
    {
        'id': '08',
        'file': '08.pdf',
        'vendor_name': 'Servicios Cloud Andinos',
        'po_number': 'PO-1002',
        'amount': 4500,
        'currency': 'USD',
        'expected': 'ESCALATE',
        'why': 'Same amount in 30 days as invoice 02'
    },
    {
        'id': '09',
        'file': '09.pdf',
        'vendor_name': 'Grupo Andes Consultores',
        'po_number': None,
        'amount': 2100,
        'currency': 'USD',
        'expected': 'ESCALATE',
        'why': 'Vendor not registered (NIT 901777333-5)'
    },
    {
        'id': '10',
        'file': '10.pdf',
        'vendor_name': 'Tecnologia Paulista',
        'po_number': 'PO-1004',
        'amount': 16200,
        'currency': 'BRL',
        'expected': 'ESCALATE',
        'why': '8% over PO amount (15000 * 1.08 = 16200)'
    },
    {
        'id': '11',
        'file': '11.pdf',
        'vendor_name': 'Servicios Cloud Andinos',
        'po_number': 'PO-1006',
        'amount': 12000,
        'currency': 'USD',
        'expected': 'ESCALATE',
        'why': 'Human threshold (amount >= 10000 USD)'
    },
    {
        'id': '12',
        'file': '12.pdf',
        'vendor_name': 'Servicios Cloud Andinos',
        'po_number': 'PO-1009',
        'amount': 25000,
        'currency': 'USD',
        'expected': 'HOLD',
        'why': 'Monthly budget exceeded'
    },
    {
        'id': '13',
        'file': '13.txt',
        'vendor_name': 'Comercializadora Aurora',
        'po_number': 'PO-1010',
        'amount': 22000000,
        'currency': 'COP',
        'expected': 'ESCALATE',
        'why': 'Per-payment limit (over 5000 USD)'
    },
    {
        'id': '14',
        'file': '14.png',
        'vendor_name': 'Logística del Bajío',
        'po_number': 'PO-1003',
        'amount': None,  # unreadable
        'currency': 'MXN',
        'expected': 'ESCALATE',
        'why': 'Missing data (blurred, total cut off)'
    },
    {
        'id': '15',
        'file': '15.pdf',
        'vendor_name': 'Distribuciones Orión',
        'po_number': None,
        'amount': 3560000,
        'currency': 'COP',
        'expected': 'HOLD',
        'why': 'Blocked vendor'
    },
    {
        'id': '16',
        'file': '16.txt',
        'vendor_name': 'Northwind Software Inc.',
        'po_number': None,
        'amount': 1950,
        'currency': 'USD',
        'expected': 'ESCALATE',
        'why': 'No PO, but will be PAY after ALLOW rule from feedback loop'
    }
]

def create_pdf_invoice(filename, vendor, po_number, amount, currency, issue_date, due_date, invoice_number):
    """Create a PDF invoice."""
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=1  # Center
    )
    story.append(Paragraph("FACTURA", title_style))
    story.append(Spacer(1, 12))
    
    # Invoice info
    invoice_info = [
        ["Factura #:", invoice_number],
        ["Fecha de emisión:", issue_date.strftime('%Y-%m-%d')],
        ["Fecha de vencimiento:", due_date.strftime('%Y-%m-%d')],
        ["Moneda:", currency],
    ]
    invoice_table = Table(invoice_info, colWidths=[2*inch, 3*inch])
    invoice_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(invoice_table)
    story.append(Spacer(1, 20))
    
    # Vendor info
    vendor_data = [
        ["Proveedor:", vendor['name']],
        ["NIT/ID:", vendor['tax_id']],
        ["Cuenta bancaria:", vendor['bank_account']],
    ]
    vendor_table = Table(vendor_data, colWidths=[2*inch, 3*inch])
    vendor_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(vendor_table)
    story.append(Spacer(1, 20))
    
    # PO info
    if po_number:
        po_data = [
            ["Orden de compra:", po_number],
            ["Descripción:", PURCHASE_ORDERS[po_number]['description']],
        ]
        po_table = Table(po_data, colWidths=[2*inch, 3*inch])
        po_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(po_table)
        story.append(Spacer(1, 20))
    
    # Line items
    # Simple line item: one item with the total amount
    line_item_data = [
        ["Descripción", "Cantidad", "Precio unitario", "Total"],
        ["Servicios / Productos", "1", f"{amount:,.2f}", f"{amount:,.2f} {currency}"],
        ["", "", "Subtotal:", f"{amount:,.2f} {currency}"],
        ["", "", "Impuesto (0%):", "0.00 {currency}"],
        ["", "", "TOTAL:", f"{amount:,.2f} {currency}"],
    ]
    line_item_table = Table(line_item_data, colWidths=[3*inch, 1*inch, 1.5*inch, 1.5*inch])
    line_item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    story.append(line_item_table)
    
    doc.build(story)

def create_png_invoice(filename, vendor, po_number, amount, currency, issue_date, due_date, invoice_number):
    """Create a PNG invoice."""
    # Create a white image
    width, height = 800, 1000
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    
    # Try to load a font, fallback to default if not available
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except IOError:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    y_position = 50
    
    # Title
    draw.text((width//2, y_position), "FACTURA", fill='black', font=font_large, anchor="mm")
    y_position += 50
    
    # Invoice info
    draw.text((50, y_position), f"Factura #: {invoice_number}", fill='black', font=font_medium)
    draw.text((50, y_position + 25), f"Fecha de emisión: {issue_date.strftime('%Y-%m-%d')}", fill='black', font=font_medium)
    draw.text((50, y_position + 50), f"Fecha de vencimiento: {due_date.strftime('%Y-%m-%d')}", fill='black', font=font_medium)
    draw.text((50, y_position + 75), f"Moneda: {currency}", fill='black', font=font_medium)
    y_position += 120
    
    # Vendor info
    draw.text((50, y_position), f"Proveedor: {vendor['name']}", fill='black', font=font_medium)
    draw.text((50, y_position + 25), f"NIT/ID: {vendor['tax_id']}", fill='black', font=font_medium)
    draw.text((50, y_position + 50), f"Cuenta bancaria: {vendor['bank_account']}", fill='black', font=font_medium)
    y_position += 100
    
    # PO info
    if po_number:
        draw.text((50, y_position), f"Orden de compra: {po_number}", fill='black', font=font_medium)
        draw.text((50, y_position + 25), f"Descripción: {PURCHASE_ORDERS[po_number]['description']}", fill='black', font=font_medium)
        y_position += 80
    
    # Amount info
    draw.text((50, y_position), f"Subtotal: {amount:,.2f} {currency}", fill='black', font=font_medium)
    draw.text((50, y_position + 25), f"Impuesto (0%): 0.00 {currency}", fill='black', font=font_medium)
    draw.text((50, y_position + 50), f"TOTAL: {amount:,.2f} {currency}", fill='black', font=font_large)
    
    # Save the image
    image.save(filename)

def create_text_file(filename, vendor_name, po_number, amount, currency):
    """Create a text file with email body content."""
    with open(filename, 'w') as f:
        f.write(f"""Estimado equipo de FacturaYa,

Adjunto les envío la factura correspondiente a los servicios prestados.

Proveedor: {vendor_name}
""")
        if po_number:
            f.write(f"Orden de compra: {po_number}\n")
        f.write(f"""Monto: {amount:,.2f} {currency}
Fecha: {date.today().strftime('%Y-%m-%d')}

Quedamos atentos a su confirmación de pago.

Saludos cordiales,
Equipo de {vendor_name}
""")

def main():
    """Main function to generate all invoices."""
    # Change to the fixtures directory
    fixtures_dir = '/home/sergi/proyectos/hackathon/.claude/worktrees/invoices/backend/tests/fixtures'
    invoices_dir = os.path.join(fixtures_dir, 'invoices')
    
    # Ensure invoices directory exists
    os.makedirs(invoices_dir, exist_ok=True)
    
    # Base date for issue dates (start from 2026-10-01)
    base_date = date(2026, 10, 1)
    
    expected_data = []
    
    for case in CASES:
        # Calculate dates
        issue_date = base_date + timedelta(days=int(case['id']) - 1)  # 01 -> 0 days, 02 -> 1 day, etc.
        due_date = issue_date + timedelta(days=30)  # 30 days net
        
        # Generate invoice number
        invoice_number = f"FAC-{case['id']}-{int(issue_date.strftime('%Y%m%d'))}"
        
        # Get vendor info
        vendor_name = case['vendor_name']
        vendor_id = None
        for vid, vinfo in VENDORS.items():
            if vinfo['name'].startswith(vendor_name.split()[0]):  # Simple match
                vendor_id = vid
                break
        
        if vendor_id is None:
            # Handle special cases like unregistered vendors
            if vendor_name == 'Grupo Andes Consultores':
                vendor = {
                    'name': vendor_name,
                    'tax_id': '901777333-5',  # From brief
                    'bank_account': 'UNKNOWN'
                }
            elif vendor_name == 'Distribuciones Orión':
                vendor = VENDORS['10000000-0000-0000-0000-000000000005']  # Blocked vendor
            elif vendor_name == 'Northwind Software Inc.':
                vendor = VENDORS['10000000-0000-0000-0000-000000000006']
            else:
                # Fallback - should not happen
                vendor = {
                    'name': vendor_name,
                    'tax_id': 'UNKNOWN',
                    'bank_account': 'UNKNOWN'
                }
        else:
            vendor = VENDORS[vendor_id]
        
        po_number = case['po_number']
        amount = case['amount']
        currency = case['currency']
        expected = case['expected']
        why = case['why']
        
        filename = case['file']
        filepath = os.path.join(invoices_dir, filename)
        
        print(f"Generating {filename}...")
        
        # Handle special case for unreadable amount (case 14)
        display_amount = amount if amount is not None else 0
        
        # Generate based on file extension
        if filename.endswith('.pdf'):
            create_pdf_invoice(filepath, vendor, po_number, display_amount, currency, issue_date, due_date, invoice_number)
        elif filename.endswith('.png'):
            create_png_invoice(filepath, vendor, po_number, display_amount, currency, issue_date, due_date, invoice_number)
        elif filename.endswith('.txt'):
            create_text_file(filepath, vendor['name'], po_number, display_amount, currency)
        
        # Add to expected data
        expected_data.append({
            'file': filename,
            'case': case['id'],
            'expected_outcome': expected,
            'why': why
        })
    
    # Write expected.json
    expected_path = os.path.join(fixtures_dir, 'expected.json')
    with open(expected_path, 'w') as f:
        json.dump(expected_data, f, indent=2)
    
    print(f"Generated {len(CASES)} invoices and expected.json")

if __name__ == '__main__':
    main()