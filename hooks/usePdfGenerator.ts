

import { useCallback } from 'react';
import { useEstimateState } from '../context/EstimateContext';
import { formatDate } from '../utils/formatters';
import { appConfig } from '../constants';
import { AdjudicationForPayer, AdjudicatedProcedure } from '../types';

// Since we are loading from CDN, we need to declare the window properties
declare global {
    interface Window {
        jspdf: any;
        jsPDF: any; // Add jsPDF as a potential direct property on window
    }
}

export const usePdfGenerator = () => {
    const { estimateData } = useEstimateState();

    const generatePDF = useCallback(() => {
        try {
            if (!estimateData) {
                console.error('No estimate data available to generate PDF.');
                alert('Could not generate PDF: Estimate data is missing.');
                return;
            }

            const { metaData, adjudicationChain, totalPatientResponsibility, procedures, nonCobPatientLiability } = estimateData;

            if (!adjudicationChain || adjudicationChain.length === 0) {
                console.error('No adjudication data available to generate PDF.');
                alert('Could not generate PDF: Adjudication data is missing or empty.');
                return;
            }
            
            const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
            if (!jsPDF) {
                console.error('PDF generation scripts (jsPDF) not loaded correctly.');
                alert('PDF generation library is not available. Please refresh the page and try again.');
                return;
            }

            const doc = new jsPDF();
            // Safely check for the autoTable plugin on the instance, not the prototype.
            if (typeof (doc as any).autoTable !== 'function') {
                console.error('PDF generation scripts (jsPDF-autotable) not loaded correctly.');
                alert('PDF generation plugin is not available. Please refresh the page and try again.');
                return;
            }
            
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            let yPos = 0;

            // --- STYLING CONSTANTS ---
            const PRIMARY_COLOR = '#2563EB'; // Blue-600
            const TEXT_COLOR = '#1F2937'; // Gray-800
            const LIGHT_TEXT_COLOR = '#6B7280'; // Gray-500
            const BORDER_COLOR = '#E5E7EB'; // Gray-200
            const MARGIN = 15;

            // --- HELPER FUNCTIONS ---
            const addFooter = () => {
                const pageCount = (doc as any).internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(LIGHT_TEXT_COLOR);
                    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 10, { align: 'right' });
                    doc.text(appConfig.brandName, MARGIN, pageHeight - 10);
                    doc.text('This is a good faith estimate, not a guarantee of final cost.', pageWidth / 2, pageHeight - 10, { align: 'center' });
                }
            };

            const checkPageBreak = (spaceNeeded: number) => {
                if (yPos + spaceNeeded > pageHeight - 20) {
                    doc.addPage();
                    yPos = MARGIN;
                }
            };

            // --- PAGE 1 HEADER ---
            doc.setFillColor(PRIMARY_COLOR);
            doc.rect(0, 0, pageWidth, 25, 'F');
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor('#FFFFFF');
            doc.text(appConfig.brandName, MARGIN, 16);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text('Good Faith Estimate', pageWidth - MARGIN, 16, { align: 'right' });
            yPos = 35;

            // --- HERO SECTION (ESTIMATED COST) ---
            doc.setFillColor('#F3F4F6'); // Gray-100
            doc.setDrawColor(BORDER_COLOR);
            doc.roundedRect(MARGIN, yPos, pageWidth - (MARGIN * 2), 30, 3, 3, 'FD');
            doc.setFontSize(14);
            doc.setTextColor(TEXT_COLOR);
            doc.text('Estimated Patient Responsibility', pageWidth / 2, yPos + 10, { align: 'center' });
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(PRIMARY_COLOR);
            doc.text(`$${totalPatientResponsibility.toFixed(2)}`, pageWidth / 2, yPos + 22, { align: 'center' });
            yPos += 40;

            // --- CONTEXT SECTION (2 COLUMNS) ---
            (doc as any).autoTable({
                startY: yPos,
                theme: 'plain',
                body: [
                    [
                        { content: 'Patient Information', styles: { fontStyle: 'bold', fontSize: 11, textColor: TEXT_COLOR } },
                        { content: 'Provider & Service Information', styles: { fontStyle: 'bold', fontSize: 11, textColor: TEXT_COLOR } },
                    ],
                    [
                        {
                            content: `
                                ${metaData.patient.name}
                                DOB: ${formatDate(metaData.patient.dob)}
                                Relationship: ${metaData.patient.relationship}
                            `,
                            styles: { fontSize: 9, cellPadding: { top: 2, left: 0 } }
                        },
                        {
                            content: `
                                ${metaData.provider.name} (NPI: ${metaData.provider.npi})
                                ${metaData.practice.name}
                                Date of Service: ${formatDate(metaData.service.date)}
                            `,
                            styles: { fontSize: 9, cellPadding: { top: 2, left: 0 } }
                        }
                    ],
                ],
                styles: { textColor: LIGHT_TEXT_COLOR },
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;

            // --- SUMMARY OF SERVICES ---
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(TEXT_COLOR);
            doc.text('Summary of Services', MARGIN, yPos);
            yPos += 5;

            const summaryBody = adjudicationChain[0].procedureEstimates.map(p => {
                 const finalBalance = adjudicationChain[adjudicationChain.length - 1]
                    .procedureEstimates.find(finalP => finalP.id === p.id)?.balanceAfterPayer ?? 0;
                const nonCob = nonCobPatientLiability[p.id] ?? 0;
                const patientShare = finalBalance + nonCob;

                return [
                    `${p.cptCode} - ${procedures.find(proc => proc.id === p.id)?.authDetails.data?.description || 'Service'}`,
                    `$${p.originalBilledAmount.toFixed(2)}`,
                    `$${p.finalAllowedAmount.toFixed(2)}`,
                    `$${patientShare.toFixed(2)}`
                ];
            });

            (doc as any).autoTable({
                startY: yPos,
                head: [['Service / CPT Code', 'Billed Amount', 'Plan Allowed', 'Est. Patient Share']],
                body: summaryBody,
                theme: 'striped',
                headStyles: { fillColor: '#4B5563' }, // Gray-600
                styles: { fontSize: 9 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
            
            checkPageBreak(50);
            
            // --- HOW YOUR INSURANCE HELPS ---
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(TEXT_COLOR);
            doc.text('How Your Insurance Helps', MARGIN, yPos);
            yPos += 5;

            (doc as any).autoTable({
                startY: yPos,
                head: [['Payer', 'Network Status', 'Estimated Plan Payment']],
                body: adjudicationChain.map(adj => [
                    `${adj.rank}: ${adj.insurance.name}`,
                    adj.networkStatus.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    `$${adj.totalPayerPaymentThisPayer.toFixed(2)}`
                ]),
                theme: 'grid',
                headStyles: { fillColor: '#4B5563' }, // Gray-600
                styles: { fontSize: 9 },
                didDrawCell: (data: any) => {
                     if (data.column.index === 1 && data.cell.section === 'body') {
                        if (data.cell.text[0].includes('In Network')) {
                            doc.setTextColor('#16A34A'); // Green-600
                        } else {
                            doc.setTextColor('#DC2626'); // Red-600
                        }
                    }
                }
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
            
            checkPageBreak(50);
            doc.setDrawColor(BORDER_COLOR);
            doc.line(MARGIN, yPos, pageWidth - MARGIN, yPos);
            yPos += 10;

            // --- DETAILED BREAKDOWN ---
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(TEXT_COLOR);
            doc.text('Detailed Calculation Breakdown', MARGIN, yPos);
            yPos += 8;

            adjudicationChain.forEach((payerAdj: AdjudicationForPayer) => {
                checkPageBreak(30);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(PRIMARY_COLOR);
                doc.text(`${payerAdj.rank} Payer: ${payerAdj.insurance.name}`, MARGIN, yPos);
                yPos += 7;

                payerAdj.procedureEstimates.forEach((proc: AdjudicatedProcedure) => {
                    const breakdownHeight = (proc.calculationBreakdown.length * 10) + 20;
                    checkPageBreak(breakdownHeight);
                    
                    (doc as any).autoTable({
                        startY: yPos,
                        theme: 'plain',
                        body: [[
                            { content: `CPT ${proc.cptCode}`, styles: { fontStyle: 'bold' } },
                            { content: `Billed: $${proc.originalBilledAmount.toFixed(2)}`, styles: { halign: 'right' } },
                            { content: `Allowed: $${proc.finalAllowedAmount.toFixed(2)}`, styles: { halign: 'right' } },
                        ]],
                        styles: { fontSize: 9, textColor: TEXT_COLOR, cellPadding: 1 }
                    });
                    yPos = (doc as any).lastAutoTable.finalY;
                    
                    (doc as any).autoTable({
                        startY: yPos,
                        head: [['Component', 'Patient Pays', 'Notes']],
                        body: proc.calculationBreakdown.map(step => [
                            step.description,
                            `$${step.patientOwes.toFixed(2)}`,
                            step.notes,
                        ]),
                        theme: 'grid',
                        headStyles: { fillColor: '#F3F4F6', textColor: TEXT_COLOR, fontSize: 8 },
                        styles: { fontSize: 8, cellPadding: 1.5 },
                        columnStyles: {
                            1: { halign: 'right' },
                            2: { cellWidth: 80, textColor: LIGHT_TEXT_COLOR },
                        }
                    });
                    yPos = (doc as any).lastAutoTable.finalY + 5;
                });
            });

            addFooter();

            const patientName = metaData?.patient?.name || 'Patient';
            doc.save(`GoodFaithEstimate-${patientName.replace(/ /g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`);
        
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert(`An error occurred while generating the PDF. Please check the console for details. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [estimateData]);

    return { generatePDF };
};