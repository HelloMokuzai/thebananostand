import { Component, Inject, OnInit } from '@angular/core';
import * as Colors from '@brightlayer-ui/colors';
import { AccountService } from '@app/services/account.service';
import { ViewportService } from '@app/services/viewport.service';
import { TransactionService } from '@app/services/transaction.service';
import { MatDialog } from '@angular/material/dialog';
import { animate, style, transition, trigger } from '@angular/animations';
import { SecretService } from '@app/services/secret.service';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { EnterSecretDialogComponent } from '@app/overlays/dialogs/enter-secret/enter-secret-dialog.component';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { EnterSecretBottomSheetComponent } from '@app/overlays/bottom-sheet/enter-secret/enter-secret-bottom-sheet.component';
import { CreateWalletBottomSheetComponent } from '@app/overlays/bottom-sheet/create-wallet/create-wallet-bottom-sheet.component';
import { CreateWalletDialogComponent } from '@app/overlays/dialogs/create-wallet/create-wallet-dialog.component';
import { WalletStorageService } from '@app/services/wallet-storage.service';
import { WalletEventsService } from '@app/services/wallet-events.service';

@Component({
    selector: 'ledger-snack-bar',
    template: `<div style="display: flex; justify-content: space-between; align-items: center">
        <mat-icon>error_outline</mat-icon>
        <span style="margin-right: 48px; margin-left: 12px">{{ data }}</span>
        <button mat-button color="accent" style="width: 130px" #action (click)="snackBar.dismissWithAction()">
            Troubleshoot
        </button>
    </div>`,
})
export class LedgerSnackbarErrorComponent {
    constructor(
        @Inject(MAT_SNACK_BAR_DATA) public data: string,
        public snackBar: MatSnackBarRef<LedgerSnackbarErrorComponent>
    ) {}
}

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    animations: [
        trigger('fade', [
            transition('void => active', [
                // using status here for transition
                style({ opacity: 0 }),
                animate(120, style({ opacity: 1 })),
            ]),
            transition('* => void', [animate(120, style({ opacity: 0 }))]),
        ]),
    ],
})
export class HomeComponent implements OnInit {
    colors = Colors;

    isLoading = false;
    isCancelLogin = false;
    isLedgerUnlocked = false;
    isShowLedgerLoadHelperText = false;

    constructor(
        private readonly _dialog: MatDialog,
        private readonly _sheet: MatBottomSheet,
        private readonly _snackBar: MatSnackBar,
        private readonly _transactionService: TransactionService,
        private readonly _accountService: AccountService,
        private readonly _viewportService: ViewportService,
        private readonly _secretService: SecretService,
        private readonly _walletStorageService: WalletStorageService,
        private readonly _walletEventService: WalletEventsService,
        public vp: ViewportService
    ) {}

    ngOnInit(): void {
        this.isLedgerUnlocked = this._secretService.isLocalLedgerUnlocked();
    }

    isSmall(): boolean {
        return this._viewportService.isSmall();
    }

    openLedgerHomePage(): void {
        window.open('https://www.ledger.com/');
    }

    openEnterSeedDialog(): void {
        if (this.vp.sm) {
            this._sheet.open(EnterSecretBottomSheetComponent);
        } else {
            this._dialog.open(EnterSecretDialogComponent);
        }
    }

    connectLedger(): void {
        this._transactionService
            .checkLedgerOrError()
            .then(() => {
                this.isLedgerUnlocked = true;
                this._secretService.setLocalLedgerUnlocked(true);
            })
            .catch((err) => {
                const snack = this._snackBar.openFromComponent(LedgerSnackbarErrorComponent, {
                    data: err,
                    duration: 5000,
                });
                snack.onAction().subscribe(() => {
                    this.isShowLedgerLoadHelperText = true;
                });
            });
    }

    openNewWalletDialog(): void {
        const newWalletSecret = this._secretService.createNewWallet();
        if (this.vp.sm) {
            this._sheet.open(CreateWalletBottomSheetComponent, { data: newWalletSecret });
        } else {
            this._dialog.open(CreateWalletDialogComponent, { data: newWalletSecret });
        }
    }

    showDashboard(): boolean {
        return !this.showLogin() && (this.isLedgerUnlocked || this._secretService.isLocalSecretUnlocked());
    }

    showLogin(): boolean {
        return (
            !this.isLedgerUnlocked &&
            this._secretService.hasSecret() &&
            !this._secretService.isLocalSecretUnlocked() &&
            !this.isCancelLogin
        );
    }

    showHome(): boolean {
        return !this.showLogin() && !this.showDashboard();
    }
}
