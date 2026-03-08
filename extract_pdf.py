import fitz
doc = fitz.open(r'C:\Users\Siddhant\test2\Idea Submission _ AWS AI for Bharat Hackathon.pdf')
with open(r'C:\Users\Siddhant\test2\pdf_structure.txt', 'w', encoding='utf-8') as f:
    for i in range(len(doc)):
        page = doc[i]
        blocks = page.get_text('blocks')
        f.write(f'\n=== PAGE {i+1} (size: {page.rect.width:.0f}x{page.rect.height:.0f}) ===\n')
        for j, b in enumerate(blocks):
            txt = b[4].strip().replace('\n', ' | ')
            if txt:
                f.write(f'  Block {j}: [{b[0]:.0f},{b[1]:.0f},{b[2]:.0f},{b[3]:.0f}] "{txt}"\n')
    doc.close()
print("Done - saved to pdf_structure.txt")
