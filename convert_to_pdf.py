"""Convert PPTX to PDF using PowerPoint COM automation (Windows only)."""
import comtypes.client
import os

input_path = os.path.abspath(r'C:\Users\Siddhant\test2\NidhiAI_Idea_Submission.pptx')
output_path = os.path.abspath(r'C:\Users\Siddhant\test2\NidhiAI_Idea_Submission.pdf')

powerpoint = comtypes.client.CreateObject("Powerpoint.Application")
powerpoint.Visible = 1

deck = powerpoint.Presentations.Open(input_path)
deck.SaveAs(output_path, 32)  # 32 = ppSaveAsPDF
deck.Close()
powerpoint.Quit()

print(f"✅ PDF saved to: {output_path}")
